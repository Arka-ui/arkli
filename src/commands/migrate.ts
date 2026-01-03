import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

export const migrateCommand = new Command('migrate')
    .description('Auto migrate the database to the latest version')
    .option('-d, --database <path>', 'Path to a specific database file')
    .action(async (options) => {
        try {
            log.info(`Checking migration strategy...`);

            const cwd = process.cwd();
            const pkgPath = path.join(cwd, 'package.json');
            const prismaPath = path.join(cwd, 'prisma', 'schema.prisma');

            const env: NodeJS.ProcessEnv = { ...process.env };

            // If custom DB path provided
            if (options.database) {
                const dbPath = path.resolve(options.database);
                // For Prisma/sqlite, DATABASE_URL often needs 'file:' prefix
                if (!env.DATABASE_URL) {
                    env.DATABASE_URL = `file:${dbPath}`;
                    log.info(`Setting DATABASE_URL to file:${dbPath}`);
                }
            }

            // Strategy 1: NPM Script
            if (await fs.pathExists(pkgPath)) {
                const pkg = await fs.readJson(pkgPath);
                if (pkg.scripts && pkg.scripts.migrate) {
                    log.info(`Detected 'migrate' script in package.json. Executing...`);
                    await execa('npm', ['run', 'migrate'], { stdio: 'inherit', env });
                    log.success(`Migration finished via npm script.`);
                    return;
                }
            }

            // Strategy 2: Prisma
            if (await fs.pathExists(prismaPath)) {
                log.info(`Detected Prisma schema. Executing 'prisma migrate deploy'...`);
                try {
                    await execa('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env });
                    log.success(`Prisma migration deployed.`);
                } catch (e: any) {
                    // Fallback check: maybe it needs generate first?
                    log.warn(`Prisma migrate failed. Trying 'prisma generate' first...`);
                    await execa('npx', ['prisma', 'generate'], { stdio: 'inherit', env });
                    await execa('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env });
                    log.success(`Prisma migration deployed after generation.`);
                }
                return;
            }

            // No strategy found
            log.error(`No migration strategy detected. (No 'migrate' script or Prisma schema found).`);
            log.info(`Please add a 'migrate' script to your package.json.`);

        } catch (error: any) {
            log.error(`Migration failed: ${error.message}`);
            process.exit(1);
        }
    });
