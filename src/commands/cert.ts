import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { installPackage, IS_LINUX } from '../utils/system.js';
import { execa } from 'execa';

export const certCommand = new Command('cert')
    .description('Manage SSL certificates using Certbot');

certCommand.command('setup [domain]')
    .description('Setup SSL certificate for a specific website')
    .option('-a, --auto-renew', 'Enable auto renewal')
    .action(async (domain, options) => {
        log.info(`Setting up SSL for ${domain}...`);

        await installPackage('certbot');
        await installPackage('python3-certbot-nginx'); // Assuming Nginx, or apache

        if (IS_LINUX) {
            try {
                // Try nginx plugin first
                log.info('Attempting certbot --nginx...');
                await execa('sudo', ['certbot', '--nginx', '-d', domain], { stdio: 'inherit' });
            } catch (e) {
                log.warn('Nginx plugin failed or not interactive. Trying standalone...');
                await execa('sudo', ['certbot', 'certonly', '--standalone', '-d', domain], { stdio: 'inherit' });
            }
            log.success(`Certificate setup for ${domain}.`);
        } else {
            log.info(`(Simulation) Certbot setup for ${domain} executed.`);
        }
    });

certCommand.command('list') // domain arg in prompt usually filter, but certbot certificates lists all
    .description('List all certificates')
    .action(async () => {
        log.info('Listing certificates...');
        if (IS_LINUX) {
            await execa('sudo', ['certbot', 'certificates'], { stdio: 'inherit' });
        } else {
            log.info('(Simulation) Certbot certificates listed.');
        }
    });

certCommand.command('delete [domain]')
    .description('Delete certificate')
    .action(async (domain) => {
        log.info(`Deleting certificate for ${domain}...`);
        if (IS_LINUX) {
            await execa('sudo', ['certbot', 'delete', '--cert-name', domain], { stdio: 'inherit' });
        } else {
            log.info('(Simulation) Certificate deleted.');
        }
    });
