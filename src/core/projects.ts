import { ensureProjectStructure, getProject, unregisterProject, IS_LINUX, writePrivilegedFile, getNextAvailablePort } from '../utils/system.js';
import { log } from '../utils/logger.js';
import { ensureDependency } from '../utils/dependencies.js';
import { generateDockerConfig } from './docker.js';
import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';

import { getTemplate } from './templates.js';

/**
 * Initialize a new website project with isolated environment.
 */
export async function createProject(name: string, templateId: string = 'nextjs'): Promise<void> {
    log.info(`[Core] Starting initialization for ${name} using ${templateId}...`);
    await ensureDependency('docker');

    const template = getTemplate(templateId);
    if (!template) {
        throw new Error(`Template ${templateId} not found.`);
    }

    // Assign port and create structure
    const port = await getNextAvailablePort();
    const { projectPath, dataPath } = await ensureProjectStructure(name, port);

    // Generate Config from Template
    log.info(`[Core] Generating configuration for ${template.name}...`);

    if (templateId === 'nextjs') {
        await generateDockerConfig(name, projectPath, dataPath, port);
    } else {
        // App Store Project
        await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), template.compose(port, dataPath).trim());
        if (template.dockerfile) {
            await fs.writeFile(path.join(projectPath, 'Dockerfile'), template.dockerfile(port).trim());
        }
    }

    log.success(`[Core] Successfully initialized ${name} (${template.name})!`);
}

/**
 * Move files to the isolated directory.
 */
export async function moveProject(name: string, sourceDir: string): Promise<void> {
    log.info(`[Core] Locating project: ${name}...`);
    const project = await getProject(name);

    if (!project) {
        throw new Error(`Project "${name}" not found. Did you run "arkli init ${name}"?`);
    }

    // Safety check: ensure we are not in the project dir
    if (path.resolve(sourceDir) === path.resolve(project.projectPath)) {
        throw new Error(`You are already in the project directory. Run this from the temp source folder.`);
    }

    log.info(`[Core] Moving files from ${sourceDir} to ${project.projectPath} and ${project.dataPath}...`);

    const files = await fs.readdir(sourceDir);

    for (const file of files) {
        const srcPath = path.join(sourceDir, file);

        if (file === '.git' || file === 'node_modules') {
            // Skip logic if needed
        }

        let destPath = path.join(project.projectPath, file);

        // Detection Logic
        if (file.startsWith('.env')) {
            destPath = path.join(project.dataPath, 'env', file);
            log.info(`Detected config file: ${file} -> Isolated Storage`);
            await fs.move(srcPath, destPath, { overwrite: true });

            try {
                await fs.ensureSymlink(destPath, path.join(project.projectPath, file));
                log.info(`Linked ${file} back to project root.`);
            } catch (e: any) {
                log.warn(`Failed to symlink .env: ${e.message}. You might need to admin logic or manual config.`);
            }
            continue;
        }

        if (file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.sqlite3')) {
            destPath = path.join(project.dataPath, 'db', file);
            log.info(`Detected database: ${file} -> Isolated Storage`);
            await fs.move(srcPath, destPath, { overwrite: true });

            try {
                await fs.ensureSymlink(destPath, path.join(project.projectPath, file));
                log.info(`Linked ${file} back to project root.`);
            } catch (e: any) {
                log.warn(`Failed to symlink DB: ${e.message}`);
            }
            continue;
        }

        // Normal move
        await fs.move(srcPath, destPath, { overwrite: true });
    }

    // Cleanup
    log.info(`[Core] Cleaning up temporary directory...`);
    await fs.emptyDir(sourceDir);
    log.success(`[Core] Migration complete! Temporary files removed.`);
}

/**
 * Completely delete a project and all associated data.
 */
export async function deleteProject(name: string): Promise<void> {
    const project = await getProject(name);
    if (!project) {
        throw new Error(`Project ${name} not found.`);
    }

    log.info(`[Core] Initiating destruction for project: ${name}...`);

    // 1. Docker Cleanup
    log.info('[Core] Stopping containers...');
    try {
        // Webmail
        const webmailDir = path.join(project.dataPath, 'webmail');
        if (await fs.pathExists(webmailDir)) {
            try {
                await execa('docker', ['compose', 'down', '-v'], { cwd: webmailDir, stdio: 'inherit' });
            } catch (e) {
                // Try sudo if permission denied
                await execa('sudo', ['docker', 'compose', 'down', '-v'], { cwd: webmailDir, stdio: 'inherit' }).catch(() => { });
            }
        }

        // Main Project
        if (await fs.pathExists(project.projectPath)) {
            try {
                await execa('docker', ['compose', 'down', '-v'], { cwd: project.projectPath, stdio: 'inherit' });
            } catch (e) {
                await execa('sudo', ['docker', 'compose', 'down', '-v'], { cwd: project.projectPath, stdio: 'inherit' }).catch(() => { });
            }
        }
    } catch (e) {
        log.warn('[Core] Error stopping containers (ignoring): ' + e);
    }

    // 2. Nginx Cleanup
    if (IS_LINUX && project.domain) {
        log.info('[Core] Removing Nginx configurations...');
        const domains = [project.domain, `webmail.${project.domain}`];
        for (const d of domains) {
            try {
                await execa('sudo', ['rm', '-f', `/etc/nginx/sites-enabled/${d}`]);
                await execa('sudo', ['rm', '-f', `/etc/nginx/sites-available/${d}`]);
            } catch (e) { }
        }
        await execa('sudo', ['systemctl', 'reload', 'nginx']).catch(() => { });
    }

    // 3. SSL Cleanup
    if (IS_LINUX && project.domain) {
        log.info('[Core] Revoking SSL certificates...');
        const domains = [project.domain, `webmail.${project.domain}`];
        for (const d of domains) {
            try {
                await execa('sudo', ['certbot', 'delete', '--cert-name', d, '--non-interactive']).catch(() => { });
            } catch (e) { }
        }
    }

    // 4. Mail Cleanup
    if (IS_LINUX) {
        log.info('[Core] Cleaning up mail users...');
        try {
            if (await fs.pathExists('/etc/postfix/virtual')) {
                const content = await fs.readFile('/etc/postfix/virtual', 'utf-8');
                const lines = content.split('\n');
                const newLines = [];
                const usersToDelete: string[] = [];

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    // Format: email@domain   user_project
                    const parts = trimmed.split(/\s+/);
                    if (parts.length >= 2) {
                        const sysUser = parts[parts.length - 1];
                        if (sysUser.endsWith(`_${name}`)) {
                            usersToDelete.push(sysUser);
                            continue; // Skip adding this line
                        }
                    }
                    newLines.push(line);
                }

                // Rewrite virtual file
                await writePrivilegedFile('/etc/postfix/virtual', newLines.join('\n'));
                await execa('sudo', ['postmap', '/etc/postfix/virtual']).catch(() => { });

                // Delete System Users
                for (const usr of usersToDelete) {
                    log.info(`[Core] Deleting system user: ${usr}`);
                    await execa('sudo', ['userdel', '-r', usr]).catch((e) => log.warn(`Failed to delete user ${usr}: ${e.message}`));
                }
            }
        } catch (e) {
            log.warn('[Core] Mail cleanup had issues: ' + e);
        }
    }

    // 5. File Cleanup
    log.info('[Core] Deleting files...');
    try {
        // Data Dir (Brain)
        if (await fs.pathExists(project.dataPath)) {
            await fs.remove(project.dataPath);
            if (await fs.pathExists(project.dataPath)) {
                await execa('sudo', ['rm', '-rf', project.dataPath]);
            }
        }

        // Project Dir (Code)
        if (await fs.pathExists(project.projectPath)) {
            await fs.remove(project.projectPath);
            if (await fs.pathExists(project.projectPath)) {
                await execa('sudo', ['rm', '-rf', project.projectPath]);
            }
        }
    } catch (e) {
        log.error('[Core] Failed to delete files: ' + e);
    }

    // 6. Registry Cleanup
    await unregisterProject(name);

    log.success(`[Core] Project ${name} has been deleted.`);
}
