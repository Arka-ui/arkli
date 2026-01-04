import { Command } from 'commander';
import { ensureProjectStructure } from '../utils/system.js';
import { log } from '../utils/logger.js';
import inquirer from 'inquirer';

export const initCommand = new Command('init')
    .description('Initialize a new website project with isolated environment')
    .argument('<name>', 'Name of the website/project')
    .action(async (name) => {
        try {
            log.info(`Starting initialization for ${name}...`);
            const { ensureDependency } = await import('../utils/dependencies.js');
            await ensureDependency('docker');

            await ensureProjectStructure(name);
            log.success(`Successfully initialized ${name}!`);

            log.info(`\nNext steps:`);
            log.info(`  cd ${name}`);
            log.info(`  (Start building your website)`);
            log.info(`  arkli move ${name} (When ready to secure .env and db)`);

        } catch (error) {
            // Error logged in util
            process.exit(1);
        }
    });
