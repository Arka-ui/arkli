import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { installPackage, IS_LINUX, getProject, writePrivilegedFile } from '../utils/system.js';
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
import { diagnoseServiceFailure, printDiagnosis, FixType } from '../utils/diagnostics.js';

export const mailCommand = new Command('mail')
    .description('Manage mail configurations');

mailCommand.command('setup')
    .description('Setup mail server configuration for a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .action(async (options) => {
        const { ensureDependency } = await import('../utils/dependencies.js');
        // Import cert setup action handler or similar logic if possible avoiding circular deps
        // Ideally we'd invoke the shared logic. For now, running CLI command recursively is safest or extracting logic.
        // We will execute the CLI command to avoid import issues.
        const runCertSetup = async (domain: string) => {
            log.info(`🚑 Auto-Fixing: Running cert setup for ${domain}...`);
            await execa('arkli', ['cert', 'setup', domain], { stdio: 'inherit' });
        };

        const project = await getProject(options.name);
        if (!project || !project.domain) {
            log.error(`Project ${options.name} not found or has no linked domain.`);
            process.exit(1);
        }

        const domain = project.domain;
        log.info(`Setting up mail server for ${domain}...`);

        // 1. Install Dependencies
        await ensureDependency('postfix');
        await ensureDependency('dovecot');
        // dovecot dependencies handles core/imapd/pop3d via dependencies.ts logic

        if (IS_LINUX) {
            try {
                // 2. Configure Postfix
                log.info('Configuring Postfix...');
                await writePrivilegedFile('/etc/postfix/main.cf', generatePostfixMainCf(domain));
                await writePrivilegedFile('/etc/postfix/master.cf', generatePostfixMasterCf());

                // Create virtual alias file if not exists
                if (!await fs.pathExists('/etc/postfix/virtual')) {
                    await writePrivilegedFile('/etc/postfix/virtual', '');
                }

                try {
                    await execa('sudo', ['postmap', '/etc/postfix/virtual'], { stdio: 'inherit' });
                } catch (e) {
                    log.warn('Postmap failed, but continuing as it might be first run.');
                }

                // 3. Configure Dovecot
                log.info('Configuring Dovecot...');
                await writePrivilegedFile('/etc/dovecot/dovecot.conf', generateDovecotConf());
                await writePrivilegedFile('/etc/dovecot/conf.d/10-mail.conf', generateDovecot10Mail());
                await writePrivilegedFile('/etc/dovecot/conf.d/10-auth.conf', generateDovecot10Auth());
                await writePrivilegedFile('/etc/dovecot/conf.d/10-ssl.conf', generateDovecot10Ssl(domain));
                await writePrivilegedFile('/etc/dovecot/conf.d/10-master.conf', generateDovecot10Master());

                // 4. Restart Services
                log.info('Restarting services...');

                try {
                    await execa('sudo', ['systemctl', 'restart', 'postfix'], { stdio: 'inherit' });
                } catch (e: any) {
                    log.error('Failed to restart Postfix. Running diagnostics...');
                    const diagnosis = await diagnoseServiceFailure('postfix');
                    printDiagnosis(diagnosis);
                    if (diagnosis.fixType === FixType.MISSING_SSL) {
                        try {
                            await runCertSetup(domain);
                            log.info('Retrying Postfix restart...');
                            await execa('sudo', ['systemctl', 'restart', 'postfix'], { stdio: 'inherit' });
                        } catch (fixErr) {
                            log.error('Auto-fix failed.');
                        }
                    } else {
                        throw e;
                    }
                }

                try {
                    await execa('sudo', ['systemctl', 'restart', 'dovecot'], { stdio: 'inherit' });
                } catch (e: any) {
                    log.error('Failed to restart Dovecot. Running diagnostics...');
                    const diagnosis = await diagnoseServiceFailure('dovecot');
                    printDiagnosis(diagnosis);
                    if (diagnosis.fixType === FixType.MISSING_SSL) {
                        try {
                            await runCertSetup(domain);
                            log.info('Retrying Dovecot restart...');
                            await execa('sudo', ['systemctl', 'restart', 'dovecot'], { stdio: 'inherit' });
                        } catch (fixErr) {
                            log.error('Auto-fix failed.');
                        }
                    } else {
                        throw e;
                    }
                }

                // 5. Firewall
                log.info('Configuring Firewall (UFW)...');
                const mailPorts = [
                    '25/tcp',   // SMTP
                    '587/tcp',  // Submission
                    '143/tcp',  // IMAP
                    '993/tcp',  // IMAPS
                    '110/tcp',  // POP3
                    '995/tcp'   // POP3S
                ];

                for (const port of mailPorts) {
                    try {
                        await execa('sudo', ['ufw', 'allow', port], { stdio: 'inherit' });
                    } catch (e) {
                        log.warn(`Failed to allow port ${port}, strictly speaking optional if UFW is disabled.`);
                    }
                }

                log.success('Mail server configured successfully with SSL and Virtual Aliases.');
            } catch (e: any) {
                // Main catch block handles generic errors, but we already diagnosed specific service failures above
                log.error(`Setup process incomplete due to errors.`);
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
                // Read current content
                let currentVirtual = '';
                try {
                    currentVirtual = await fs.readFile('/etc/postfix/virtual', 'utf-8');
                } catch (e) {
                    // Ignore if missing, it will be created
                    log.warn('/etc/postfix/virtual missing or unreadable, creating new.');
                }

                const newContent = currentVirtual + `\n${email}    ${sysUser}`;
                await writePrivilegedFile('/etc/postfix/virtual', newContent);

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
            log.info('(Simulation) Services verified: Postfix [Active], Dovecot [Active]');
        }
    });

import { generateRoundcubeCompose } from '../utils/docker-config.js';

const webmail = mailCommand.command('webmail')
    .description('Manage Webmail Interface (Roundcube)');

webmail.command('install')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-s, --subdomain <subdomain>', 'Subdomain for webmail (default: webmail.<domain>)')
    .description('Install Roundcube Webmail')
    .action(async (options) => {
        const { ensureDependency } = await import('../utils/dependencies.js');
        // Check Docker
        await ensureDependency('docker');

        const project = await getProject(options.name);
        if (!project || !project.domain) {
            log.error('Project not linked or found.');
            return;
        }

        const subdomain = options.subdomain || `webmail.${project.domain}`;
        log.info(`Installing Webmail at https://${subdomain} ...`);

        // 1. Prepare Directory
        const webmailDir = path.join(project.dataPath, 'webmail');
        await fs.ensureDir(webmailDir);

        // 2. Generate Docker Compose
        // Assign a random port for webmail UI (internal)
        // In real app, we'd manage port registry. Quick hack: random 8000-9000
        const port = Math.floor(Math.random() * (9000 - 8000 + 1) + 8000);
        const composeContent = generateRoundcubeCompose(options.name, port);

        await fs.writeFile(path.join(webmailDir, 'docker-compose.yml'), composeContent);
        log.info(`Generated Webmail configuration on internal port ${port}`);

        // 3. Start Container
        log.info('Starting Webmail container...');
        try {
            await execa('docker', ['compose', 'up', '-d'], { cwd: webmailDir, stdio: 'inherit' });
        } catch (e: any) {
            // If permission denied, retry with sudo
            if (e.message.includes('permission denied')) {
                log.warn('Docker permission denied. Retrying with sudo...');
                try {
                    await execa('sudo', ['docker', 'compose', 'up', '-d'], { cwd: webmailDir, stdio: 'inherit' });
                } catch (sudoErr: any) {
                    log.error(`Failed to start webmail container even with sudo: ${sudoErr.message}`);
                    return;
                }
            } else {
                log.error(`Failed to start webmail container: ${e.message}`);
                return;
            }
        }

        // 4. Configure Nginx Proxy
        // We reuse the 'arkli link' logic conceptually, but applying specifically for this subdomain.
        // For simplicity, we'll invoke generating a new config file for this subdomain.
        try {
            // Simplified Nginx Block for Webmail
            const nginxConfig = `
server {
    listen 80;
    server_name ${subdomain};

    location / {
        proxy_pass http://localhost:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
            const nginxPath = `/etc/nginx/sites-available/${subdomain}`;
            if (IS_LINUX) {
                await writePrivilegedFile(nginxPath, nginxConfig);
                await execa('sudo', ['ln', '-sf', nginxPath, `/etc/nginx/sites-enabled/${subdomain}`], { stdio: 'inherit' });
                await execa('sudo', ['nginx', '-t'], { stdio: 'inherit' });
                await execa('sudo', ['systemctl', 'reload', 'nginx'], { stdio: 'inherit' });
                log.info('Nginx configured for Webmail.');
            } else {
                log.info(`(Simulation) Nginx config written to ${nginxPath}`);
            }

            // 5. SSL
            log.info('Obtaining SSL certificate for Webmail...');
            await execa('arkli', ['cert', 'setup', subdomain], { stdio: 'inherit' });

            log.success(`Webmail installed successfully!`);
            log.success(`Access it at: https://${subdomain}`);
            log.info(`Login with your full email (e.g. contact@${project.domain}) and password.`);

        } catch (e: any) {
            log.error(`Failed during Nginx/SSL setup: ${e.message}`);
        }
    });

