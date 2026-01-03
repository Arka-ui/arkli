import { Command } from 'commander';
import { getProject, updateProjectDomain, installPackage, IS_LINUX } from '../utils/system.js';
import { log } from '../utils/logger.js';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

export const linkCommand = new Command('link')
    .description('Link a domain name to a project')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .requiredOption('-n, --name <name>', 'Project name')
    .action(async (options) => {
        const { domain, name } = options;
        log.info(`Linking domain ${domain} to project ${name}...`);

        const project = await getProject(name);
        if (!project) {
            log.error(`Project ${name} not found.`);
            process.exit(1);
        }

        // 1. Update Registry & Config
        await updateProjectDomain(name, domain);
        log.success(`Project ${name} associated with ${domain}.`);

        // 2. Nginx Configuration
        if (IS_LINUX) {

            const port = project.port || 3000;
            log.info(`Configuring Nginx Reverse Proxy for ${domain} -> localhost:${port}...`);
            await installPackage('nginx');

            // Reverse Proxy Config for Docker Container
            const nginxConfig = `
server {
    listen 80;
    server_name ${domain} www.${domain};

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
            const sitesAvailable = `/etc/nginx/sites-available/${domain}`;
            const sitesEnabled = `/etc/nginx/sites-enabled/${domain}`;

            try {
                // Write config (need sudo, complex via node script running as user)
                // We'll try to write to temp then move.
                const tempConfigPath = `/tmp/${domain}`;
                await fs.writeFile(tempConfigPath, nginxConfig);

                await execa('sudo', ['mv', tempConfigPath, sitesAvailable], { stdio: 'inherit' });
                await execa('sudo', ['ln', '-sf', sitesAvailable, sitesEnabled], { stdio: 'inherit' });

                // Test and Reload
                await execa('sudo', ['nginx', '-t'], { stdio: 'inherit' });
                await execa('sudo', ['systemctl', 'reload', 'nginx'], { stdio: 'inherit' });

                log.success(`Nginx configured for ${domain} (Proxying to port ${port})`);
            } catch (e: any) {
                log.error(`Failed to configure Nginx: ${e.message}`);
                log.warn(`You might need to manually configure /etc/nginx/sites-available/${domain}`);
            }

        } else {
            const port = project.port || 3000;
            log.info(`(Simulation) Nginx proxy configured for ${domain} -> localhost:${port}.`);
        }

        log.success(`Link complete. Mail services for ${name} are now unlocked for ${domain}.`);
    });
