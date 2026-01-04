import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { getProject, unregisterProject, IS_LINUX, writePrivilegedFile } from '../utils/system.js';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';

export const deleteCommand = new Command('delete')
    .description('Completely delete a project and all associated data')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('--force', 'Force delete without confirmation')
    .action(async (options) => {
        const project = await getProject(options.name);
        if (!project) {
            log.error(`Project ${options.name} not found.`);
            process.exit(1);
        }

        // Confirmation
        if (!options.force) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `⚠️  DANGER: This will COMPLETELY DESTROY project '${options.name}'.\n     It will delete databases, emails, SSL certs, and files.\n     Are you absolutely sure?`,
                    default: false
                }
            ]);
            if (!answer.confirm) {
                log.info('Deletion cancelled.');
                return;
            }
        }

        log.info(`🔥 Initiating self-destruct for project: ${options.name}...`);

        // 1. Docker Cleanup
        log.info('Stopping containers...');
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
            log.warn('Error stopping containers (ignoring): ' + e);
        }

        // 2. Nginx Cleanup
        if (IS_LINUX && project.domain) {
            log.info('Removing Nginx configurations...');
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
            log.info('Revoking SSL certificates...');
            const domains = [project.domain, `webmail.${project.domain}`];
            for (const d of domains) {
                try {
                    await execa('sudo', ['certbot', 'delete', '--cert-name', d, '--non-interactive']).catch(() => { });
                } catch (e) { }
            }
        }

        // 4. Mail Cleanup
        if (IS_LINUX) {
            log.info('Cleaning up mail users...');
            // Find users with suffix _projectName
            // This is risky to regex /etc/passwd directly. 
            // Better strategy: We know the pattern is user_projectName.
            // We can't easily list them without standard tools. 
            // For now, we will rely on cleaning up the virtual map which disables them.
            // Advanced: Read /etc/postfix/virtual, find lines with `_projectName`, extract user, delete user.

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
                        // We check if the target user ends with _projectname
                        const parts = trimmed.split(/\s+/);
                        if (parts.length >= 2) {
                            const sysUser = parts[parts.length - 1];
                            if (sysUser.endsWith(`_${options.name}`)) {
                                usersToDelete.push(sysUser);
                                continue; // Skip adding this line to new file
                            }
                        }
                        newLines.push(line);
                    }

                    // Rewrite virtual file
                    await writePrivilegedFile('/etc/postfix/virtual', newLines.join('\n'));
                    await execa('sudo', ['postmap', '/etc/postfix/virtual']).catch(() => { });

                    // Delete System Users
                    for (const usr of usersToDelete) {
                        log.info(`Deleting system user: ${usr}`);
                        await execa('sudo', ['userdel', '-r', usr]).catch((e) => log.warn(`Failed to delete user ${usr}: ${e.message}`));
                    }
                }
            } catch (e) {
                log.warn('Mail cleanup had issues: ' + e);
            }
        }

        // 5. File Cleanup
        log.info('Deleting files...');
        try {
            // Data Dir (Brain)
            if (await fs.pathExists(project.dataPath)) {
                await fs.remove(project.dataPath); // fs-extra remove is recursive
                // If permission denied (docker files often root), try sudo
                if (await fs.pathExists(project.dataPath)) {
                    await execa('sudo', ['rm', '-rf', project.dataPath]);
                }
            }

            // Project Dir (Code)
            if (await fs.pathExists(project.projectPath)) {
                await fs.remove(project.projectPath);
                // If permission denied
                if (await fs.pathExists(project.projectPath)) {
                    await execa('sudo', ['rm', '-rf', project.projectPath]);
                }
            }
        } catch (e) {
            log.error('Failed to delete files: ' + e);
        }

        // 6. Registry Cleanup
        await unregisterProject(options.name);

        log.success(`Project ${options.name} has been deleted.`);
    });
