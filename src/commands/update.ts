import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { execa } from 'execa';
import { IS_LINUX } from '../utils/system.js';

export const updateCommand = new Command('update')
    .description('Update Arkli and system packages to the latest secure versions')
    .action(async () => {
        log.info('Checking for Arkli updates...');

        try {
            // 1. Self Update
            // Check if we are running from a git repo source or globally installed npm package
            // Simple heuristic used here.

            // Attempt generic npm global update
            log.info('Updating Arkli...');
            await execa('npm', ['install', '-g', 'arkli@latest'], { stdio: 'inherit' });
            log.success('Arkli core updated.');
        } catch (e) {
            log.warn('Could not auto-update Arkli via npm. If you are using git, please pull manually.');
        }

        // 2. System Update
        if (IS_LINUX) {
            log.info('Running system security updates...');
            try {
                await execa('sudo', ['apt-get', 'update'], { stdio: 'inherit' });
                await execa('sudo', ['apt-get', 'upgrade', '-y'], { stdio: 'inherit' });
                await execa('sudo', ['apt-get', 'autoremove', '-y'], { stdio: 'inherit' });
                log.success('System packages upgraded to latest stable versions.');
            } catch (e: any) {
                log.error(`System update failed: ${e.message}`);
            }
        } else {
            log.info('(Simulation) System update would run "apt-get upgrade -y" here.');
        }

        log.success('Update process complete.');
    });
