import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { moveProject } from '../core/projects.js';

export const moveCommand = new Command('move')
    .description('Move files to the isolated directory')
    .argument('<name>', 'Name of the website/project')
    .action(async (name) => {
        try {
            await moveProject(name, process.cwd());
        } catch (error: any) {
            log.error(`Move failed: ${error.message}`);
            process.exit(1);
        }
    });
