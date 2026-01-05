import { log } from '../utils/logger.js';
import { installPackage, IS_LINUX } from '../utils/system.js';
import { execa } from 'execa';
import fs from 'fs-extra';

export async function configureNginx(domain: string, port: number) {
    if (!IS_LINUX) {
        log.info(`(Simulation) Nginx proxy configured for ${domain} -> localhost:${port}.`);
        return;
    }

    log.info(`[Core] Configuring Nginx Reverse Proxy for ${domain} -> localhost:${port}...`);
    await installPackage('nginx');

    // Reverse Proxy Config
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
        const tempConfigPath = `/tmp/${domain}`;
        await fs.writeFile(tempConfigPath, nginxConfig);

        await execa('sudo', ['mv', tempConfigPath, sitesAvailable], { stdio: 'inherit' });
        await execa('sudo', ['ln', '-sf', sitesAvailable, sitesEnabled], { stdio: 'inherit' });

        // Test and Reload
        await execa('sudo', ['nginx', '-t'], { stdio: 'inherit' });
        await execa('sudo', ['systemctl', 'reload', 'nginx'], { stdio: 'inherit' });

        log.success(`[Core] Nginx configured for ${domain} (Proxying to port ${port})`);
    } catch (e: any) {
        log.error(`[Core] Failed to configure Nginx: ${e.message}`);
        throw e;
    }
}
