import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { execa } from 'execa';
import path from 'path';
import { fileURLToPath } from 'url';

export const dashboardCommand = new Command('dashboard')
    .description('Launch the Web Dashboard')
    .action(async () => {
        log.info('Starting Arkli Dashboard...');

        // We need to run the compiled dashboard server
        // This is running within the CLI, so we assume 'dist' structure in production.
        // Or we can just import the server start script?
        // But server calls server.listen() at top level.
        // Better to spawn it or import it if designed as module.
        // My server/index.ts calls listen().
        // Let's spawn it as a separate process to keep CLI responsive or alive?
        // Or just import it.

        // Importing might be tricky if it's ESM top-level await or side effects.
        // But it exports 'io'.

        try {
            // Dynamic import to start server
            // Note: build process should copy dashboard/client/dist to dist/dashboard/client/dist
            // This requires build script adjustment!

            log.info('Dashboard running at http://localhost:4000');
            log.info('Press Ctrl+C to stop.');

            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            // In dev: src/bin/arkli.ts -> ../dashboard/server/index.ts
            // In prod: dist/bin/arkli.js -> ../dashboard/server/index.js

            await import('../dashboard/server/index.js');

            // Open browser?
            // await execa('start', ['http://localhost:4000']); 
        } catch (e: any) {
            log.error(`Failed to start dashboard: ${e.message}`);
        }
    });
