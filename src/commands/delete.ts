import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { deleteProject } from '../core/projects.js';
import inquirer from 'inquirer';

export const deleteCommand = new Command('delete')
    .description('Completely delete a project and all associated data')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('--force', 'Force delete without confirmation')
    .action(async (options) => {
        try {
            // Confirmation (UI logic stays in Command layer)
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

            await deleteProject(options.name);

        } catch (error: any) {
            log.error(`Delete failed: ${error.message}`);
            process.exit(1);
        }
    });
