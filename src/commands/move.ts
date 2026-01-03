import { Command } from 'commander';
import { getProject } from '../utils/system.js';
import { log } from '../utils/logger.js';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';

export const moveCommand = new Command('move')
    .description('Move files to the isolated directory')
    .argument('<name>', 'Name of the website/project')
    .action(async (name) => {
        try {
            log.info(`Locating project: ${name}...`);
            const project = await getProject(name);

            if (!project) {
                log.error(`Project "${name}" not found. Did you run "arkli init ${name}"?`);
                return;
            }

            const currentDir = process.cwd();
            // Safety check: ensure we are not in the project dir
            if (path.resolve(currentDir) === path.resolve(project.projectPath)) {
                log.error(`You are already in the project directory. Run this from the temp source folder.`);
                return;
            }

            log.info(`Moving files from ${currentDir} to ${project.projectPath} and ${project.dataPath}...`);

            const files = await fs.readdir(currentDir);

            for (const file of files) {
                const srcPath = path.join(currentDir, file);
                const stats = await fs.stat(srcPath);

                if (file === '.git' || file === 'node_modules') {
                    // Skip massive folders if they exist? Prompt implies "all files".
                    // But usually we don't want to move node_modules if we can help it, but "moves the files" implies everything.
                    // If it's a build artifact, maybe.
                    // Let's move everything including hidden files.
                }

                let destPath = path.join(project.projectPath, file);

                // Detection Logic
                if (file.startsWith('.env')) {
                    destPath = path.join(project.dataPath, 'env', file);
                    log.info(`Detected config file: ${file} -> Isolated Storage`);
                    await fs.move(srcPath, destPath, { overwrite: true });

                    // Creates Symlink back to project
                    // Note on Windows: Requires admin usually.
                    try {
                        await fs.ensureSymlink(destPath, path.join(project.projectPath, file));
                        log.info(`Linked ${file} back to project root.`);
                    } catch (e: any) {
                        log.warn(`Failed to symlink .env: ${e.message}. You might need to admin logic or manual config.`);
                        // Fallback: Copy it back? No that defeats isolation.
                    }
                    continue;
                }

                if (file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.sqlite3')) {
                    destPath = path.join(project.dataPath, 'db', file);
                    log.info(`Detected database: ${file} -> Isolated Storage`);
                    await fs.move(srcPath, destPath, { overwrite: true });
                    // Symlink DB?
                    // Prisma often needs relative paths or absolute.
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
            log.info(`Cleaning up temporary directory...`);
            await fs.emptyDir(currentDir);
            log.success(`Migration complete! Temporary files removed.`);

        } catch (error: any) {
            log.error(`Move failed: ${error.message}`);
            process.exit(1);
        }
    });
