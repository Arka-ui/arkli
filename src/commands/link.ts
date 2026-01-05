import { Command } from 'commander';
import { getProject, updateProjectDomain } from '../utils/system.js';
import { log } from '../utils/logger.js';
import { configureNginx } from '../core/nginx.js';

export const linkCommand = new Command('link')
    .description('Link a domain name to a project')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .requiredOption('-n, --name <name>', 'Project name')
    .action(async (options) => {
        const { domain, name } = options;
        const { ensureDependency } = await import('../utils/dependencies.js');
        await ensureDependency('nginx');

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
        const port = project.port || 3000;
        try {
            await configureNginx(domain, port);
            log.success(`Link complete. Mail services for ${name} are now unlocked for ${domain}.`);
        } catch (e: any) {
            log.warn(`You might need to manually configure /etc/nginx/sites-available/${domain}`);
        }
    });
