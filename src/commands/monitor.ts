import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { execa } from 'execa';

export const monitorCommand = new Command('monitor')
    .description('Monitor website status (Docker stats)')
    .action(async () => {
        try {
            log.info(`Fetching container statistics...`);

            // Docker stats is streaming by default, we want one shot or interactive.
            // Interactive is hard via node child_process inheritance sometimes if not TTY.
            // Let's try inherit.

            await execa('docker', ['stats', '--no-stream'], { stdio: 'inherit' });

        } catch (error: any) {
            log.error(`Failed to monitor: ${error.message}`);
            log.info('Ensure Docker is installed and running.');
        }
    });
