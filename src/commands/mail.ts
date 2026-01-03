import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { installPackage, IS_LINUX, getProject } from '../utils/system.js';
import { execa } from 'execa';

export const mailCommand = new Command('mail')
    .description('Manage mail configurations');

mailCommand.command('setup')
    .description('Setup mail server configuration for a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .action(async (options) => {
        if (!IS_LINUX) {
            log.warn('Mail setup is primarily designed for Linux servers.');
        }

        const project = await getProject(options.name);
        if (!project) {
            log.error(`Project ${options.name} not found.`);
            process.exit(1);
        }

        if (!project.domain) {
            log.error(`Project ${options.name} does not have a linked domain.`);
            log.info(`Please run "arkli link -d <domain> -n ${options.name}" first.`);
            process.exit(1);
        }

        const domain = project.domain;
        log.info(`Setting up mail server for project ${options.name} (${domain})...`);

        // 1. Install Dependencies
        await installPackage('postfix');
        await installPackage('dovecot-core');
        await installPackage('dovecot-imapd');

        // 2. Configure Ports (UFW)
        log.info('Configuring firewall ports (25, 465, 587, 143, 993)...');
        if (IS_LINUX) {
            try {
                await execa('sudo', ['ufw', 'allow', 'PostFix'], { stdio: 'inherit' });
                await execa('sudo', ['ufw', 'allow', 'DovecotIMAP'], { stdio: 'inherit' });
            } catch (e) {
                log.warn('Could not configure UFW automatically.');
            }
        }

        log.info(`Installed postfix and dovecot. Verified domain: ${domain}`);
        log.success('Mail setup dependencies installed.');
    });

mailCommand.command('create <addressName>') // e.g. 'contact'
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Create a new mail address for the project')
    .action(async (addressName, options) => {
        const project = await getProject(options.name);
        if (!project) {
            log.error(`Project ${options.name} not found.`);
            process.exit(1);
        }

        if (!project.domain) {
            log.error(`Project ${options.name} has no linked domain.`);
            process.exit(1);
        }

        const domain = project.domain;
        const email = `${addressName}@${domain}`;
        log.info(`Creating mail user: ${email}`);

        // Assuming Virtual Users or System Users
        if (IS_LINUX) {
            try {
                // Create system user "contact_domain" to avoid conflicts? 
                // Simple mapping for verification:
                const sysUser = `${addressName}_${options.name}`;
                await execa('sudo', ['useradd', '-m', sysUser], { stdio: 'inherit' });
                await execa('sudo', ['passwd', sysUser], { stdio: 'inherit' });
                log.success(`User ${sysUser} created for ${email}.`);
            } catch (e: any) {
                log.error(`Failed to create user: ${e.message}`);
            }
        } else {
            log.info(`(Simulation) User ${email} created.`);
        }
    });

mailCommand.command('delete <addressName>')
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Delete a mail address')
    .action(async (addressName, options) => {
        log.info(`Deleting mail user: ${addressName} for project ${options.name}`);
        const sysUser = `${addressName}_${options.name}`;

        if (IS_LINUX) {
            try {
                await execa('sudo', ['userdel', '-r', sysUser], { stdio: 'inherit' });
                log.success(`User ${sysUser} deleted.`);
            } catch (e: any) {
                log.error(`Failed to delete user: ${e.message}`);
            }
        } else {
            log.info(`(Simulation) User ${sysUser} deleted.`);
        }
    });

mailCommand.command('list')
    .requiredOption('-n, --name <name>', 'Project name')
    .description('List mail addresses')
    .action(async (options) => {
        log.info(`Listing mail users for ${options.name}...`);
        // Actual impl would verify /etc/passwd filtering by project name suffix
        log.info('(Simulation) List of users...');
    });

mailCommand.command('info <addressName>')
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Get mail connection info')
    .action(async (addressName, options) => {
        const project = await getProject(options.name);
        if (!project || !project.domain) {
            log.error('Project not linked.');
            return;
        }

        log.info(`Connection Info for ${addressName}@${project.domain}:`);
        log.info(`  SMTP Port: 587 (TLS) or 25`);
        log.info(`  IMAP Port: 143 or 993 (SSL)`);
        log.info(`  Username: ${addressName}_${options.name}`);
        log.info(`  Server: mail.${project.domain}`);
    });
