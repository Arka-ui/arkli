#!/usr/bin/env node
import { Command } from 'commander';
import { log } from '../utils/logger.js'; // Note .js extension for ESM usage in TS
import fs from 'fs-extra';
import path from 'path';

// Load package.json for version
const pkg = fs.readJsonSync(new URL('../../package.json', import.meta.url));

const program = new Command();

program
    .name('arkli')
    .description('Personal server management tool for website configuration')
    .version(pkg.version);

// Placeholders for commands to be imported
import { initCommand } from '../commands/init.js';

program.addCommand(initCommand);

// program.command('init <name>')
//     .description('Initialize a new website project with isolated environment')
//     .action(async (name) => {
//         log.info(`Initializing project: ${name} (Coming soon)`);
//         // await initAction(name);
//     });

import { moveCommand } from '../commands/move.js';

program.addCommand(moveCommand);

// program.command('move <name>')
//     .description('Move files to the isolated directory')
//     .action(async (name) => {
//         log.info(`Moving files for: ${name} (Coming soon)`);
//     });

import { migrateCommand } from '../commands/migrate.js';

program.addCommand(migrateCommand);

// program.command('migrate')
//     .option('-d, --database <path>', 'Path to specific database')
//     .description('Migrate database')
//     .action(async (options) => {
//         log.info(`Migrating database... (Coming soon)`);
//     });

import { mailCommand } from '../commands/mail.js';
program.addCommand(mailCommand);

import { linkCommand } from '../commands/link.js';
program.addCommand(linkCommand);

import { monitorCommand } from '../commands/monitor.js';
program.addCommand(monitorCommand);

// Mail commands
// const mailCmd = program.command('mail').description('Manage mail configurations');
// ...

// Cert commands
import { certCommand } from '../commands/cert.js';
program.addCommand(certCommand);

import { updateCommand } from '../commands/update.js';
program.addCommand(updateCommand);

import { deleteCommand } from '../commands/delete.js';
program.addCommand(deleteCommand);

// const certCmd = program.command('cert').description('Manage SSL certificates');
// ...

program.parse(process.argv);
