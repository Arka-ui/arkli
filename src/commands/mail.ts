import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { installPackage, IS_LINUX, getProject } from '../utils/system.js';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import {
    generatePostfixMainCf,
    generatePostfixMasterCf,
    generateDovecotConf,
    generateDovecot10Mail,
    generateDovecot10Auth,
    generateDovecot10Ssl,
    generateDovecot10Master
} from '../utils/mail-config.js';

export const mailCommand = new Command('mail')
    .description('Manage mail configurations');

mailCommand.command('setup')
    .description('Setup mail server configuration for a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .action(async (options) => {
        const project = await getProject(options.name);
        if (!project || !project.domain) {
            log.error(`Project ${options.name} not found or has no linked domain.`);
            process.exit(1);
        }

        const domain = project.domain;
        log.info(`Setting up mail server for ${domain}...`);

        // 1. Install Dependencies
        await installPackage('postfix');
        await installPackage('dovecot-core');
        await installPackage('dovecot-imapd');
        await installPackage('dovecot-pop3d');

        if (IS_LINUX) {
            try {
                // 2. Configure Postfix
                log.info('Configuring Postfix...');
                await fs.writeFile('/etc/postfix/main.cf', generatePostfixMainCf(domain));
                await fs.writeFile('/etc/postfix/master.cf', generatePostfixMasterCf());
                // Create virtual alias file if not exists
                if (!await fs.pathExists('/etc/postfix/virtual')) {
                    await fs.writeFile('/etc/postfix/virtual', '');
                }
                await execa('sudo', ['postmap', '/etc/postfix/virtual'], { stdio: 'inherit' });

                // 3. Configure Dovecot
                log.info('Configuring Dovecot...');
                await fs.writeFile('/etc/dovecot/dovecot.conf', generateDovecotConf());
                await fs.writeFile('/etc/dovecot/conf.d/10-mail.conf', generateDovecot10Mail());
                await fs.writeFile('/etc/dovecot/conf.d/10-auth.conf', generateDovecot10Auth());
                await fs.writeFile('/etc/dovecot/conf.d/10-ssl.conf', generateDovecot10Ssl(domain));
                await fs.writeFile('/etc/dovecot/conf.d/10-master.conf', generateDovecot10Master());

                // 4. Restart Services
                log.info('Restarting services...');
                await execa('sudo', ['systemctl', 'restart', 'postfix'], { stdio: 'inherit' });
                await execa('sudo', ['systemctl', 'restart', 'dovecot'], { stdio: 'inherit' });

                // 5. Firewall
                await execa('sudo', ['ufw', 'allow', 'PostFix'], { stdio: 'inherit' });
                await execa('sudo', ['ufw', 'allow', 'DovecotIMAP'], { stdio: 'inherit' });
                await execa('sudo', ['ufw', 'allow', 'DovecotSecure'], { stdio: 'inherit' });

                log.success('Mail server configured successfully with SSL and Virtual Aliases.');
            } catch (e: any) {
                log.error(`Setup failed: ${e.message}`);
            }
        } else {
            log.info('(Simulation) Config files generated and services restarted.');
            log.info('Generated Postfix main.cf, master.cf');
            log.info('Generated Dovecot confs (10-mail, 10-auth, 10-ssl, 10-master)');
        }
    });

mailCommand.command('create <addressName>') // e.g. 'contact'
    .requiredOption('-n, --name <name>', 'Project name')
    .description('Create a new mail address for the project')
    .action(async (addressName, options) => {
        const project = await getProject(options.name);
        if (!project || !project.domain) {
            log.error(`Project ${options.name} not found or has no linked domain.`);
            process.exit(1);
        }

        const domain = project.domain;
        const email = `${addressName}@${domain}`;
        const sysUser = `${addressName}_${options.name}`;
        log.info(`Creating mail user: ${email} mapped to system user ${sysUser}`);

        if (IS_LINUX) {
            try {
                // 1. Create System User
                await execa('sudo', ['useradd', '-m', sysUser], { stdio: 'inherit' });
                await execa('sudo', ['passwd', sysUser], { stdio: 'inherit' });

                // 2. Add to Virtual Alias Map
                // This appends "contact@domain.com    contact_arkli" to /etc/postfix/virtual
                await fs.appendFile('/etc/postfix/virtual', `\n${email}    ${sysUser}`);
                await execa('sudo', ['postmap', '/etc/postfix/virtual'], { stdio: 'inherit' });
                await execa('sudo', ['systemctl', 'reload', 'postfix'], { stdio: 'inherit' });

                log.success(`User ${sysUser} created and mapped to ${email}.`);
            } catch (e: any) {
                log.error(`Failed to create user: ${e.message}`);
            }
        } else {
            log.info(`(Simulation) User ${sysUser} created and mapped in /etc/postfix/virtual.`);
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
        } else {
            log.info('(Simulation) Services verified: Postfix [Active], Dovecot [Active]');
        }
    });
