import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { createProject } from '../core/projects.js';

export const initCommand = new Command('init')
    .description('Initialize a new website project with isolated environment')
    .argument('<name>', 'Name of the website/project')
    .option('-t, --template <template>', 'Template id (nextjs, wordpress, ghost)', 'nextjs')
    .action(async (name, options) => {
        try {
            await createProject(name, options.template);

            log.info(`\nNext steps:`);
            log.info(`  cd ${name}`);
            log.info(`  (Start building your website)`);
            log.info(`  arkli move ${name} (When ready to secure .env and db)`);

        } catch (error: any) {
            log.error(error.message);
            process.exit(1);
        }
    });
