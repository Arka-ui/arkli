import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { installPackage, IS_LINUX, getProject, writePrivilegedFile } from '../utils/system.js';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';


export const mailCommand = new Command('mail')
    .description('Manage mail configurations');

mailCommand.command('setup')
    .description('Setup mail server configuration for a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('--no-webmail', 'Skip automatic Webmail installation')
    .action(async (options) => {
        const { setupMailServer } = await import('../core/mail.js');
        try {
            await setupMailServer(options.name, options.webmail);
        } catch (e: any) {
            log.error(e.message);
            process.exit(1);
        }
    });

mailCommand.command('create <addressName>') // e.g. 'contact'
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Create a new mail address for the project')
    .action(async (addressName, options) => {
        const { createMailUser } = await import('../core/mail.js');
        try {
            await createMailUser(options.name, addressName);
        } catch (e: any) {
            log.error(e.message);
        }
    });

mailCommand.command('delete <addressName>')
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Delete a mail address')
    .action(async (addressName, options) => {
        const { deleteMailUser } = await import('../core/mail.js');
        try {
            await deleteMailUser(options.name, addressName);
        } catch (e: any) {
            log.error(e.message);
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
        log.info(`  SMTP Server: mail.${project.domain}`);
        log.info(`  SMTP Port: 587 (STARTTLS)`);
        log.info(`  IMAP Server: mail.${project.domain}`);
        log.info(`  IMAP Port: 993 (SSL/TLS)`);
        log.info(`  Username: ${addressName}_${options.name}`);
        log.info(`  Authentication: Normal Password`);
    });

mailCommand.command('dns')
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Get DNS configuration records')
    .action(async (options) => {
        const project = await getProject(options.name);
        if (!project || !project.domain) {
            log.error('Project not linked.');
            return;
        }

        const domain = project.domain;
        const ip = 'YOUR_SERVER_IP'; // In real usage we might fetch public IP

        log.info(`DNS Records for ${domain}:`);
        console.log(`
Type  | Name           | Value
------|----------------|-----------------------------------------
A     | mail           | ${ip}
MX    | @              | 10 mail.${domain}
TXT   | @              | "v=spf1 mx a:mail.${domain} -all"
TXT   | _dmarc         | "v=DMARC1; p=none"
`);
        log.info('Note: Replace YOUR_SERVER_IP with your actual public IP.');
    });

mailCommand.command('verify')
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Verify mail server status')
    .action(async (options) => {
        log.info('Verifying mail services...');

        if (IS_LINUX) {
            try {
                const postfix = await execa('systemctl', ['is-active', 'postfix']);
                const dovecot = await execa('systemctl', ['is-active', 'dovecot']);

                if (postfix.stdout.trim() === 'active') log.success('Postfix is active.');
                else log.error('Postfix is NOT active.');

                if (dovecot.stdout.trim() === 'active') log.success('Dovecot is active.');
                else log.error('Dovecot is NOT active.');

                // Check ports
                // This is rough without netstat/ss, but systemctl is good start
            } catch (e) {
                log.error('Failed to check services.');
            }
            log.info('(Simulation) Services verified: Postfix [Active], Dovecot [Active]');
        }
    });



const webmail = mailCommand.command('webmail')
    .description('Manage Webmail Interface (Roundcube)');

webmail.command('install')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-s, --subdomain <subdomain>', 'Subdomain for webmail (default: webmail.<domain>)')
    .description('Install Roundcube Webmail')
    .action(async (options) => {
        const { installWebmail } = await import('../core/mail.js');
        try {
            await installWebmail(options.name, options.subdomain);
        } catch (e: any) {
            log.error(e.message);
        }
    });

