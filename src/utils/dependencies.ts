import { execa } from 'execa';
import { log } from './logger.js';
import { IS_LINUX, IS_WINDOWS } from './system.js';

type ToolName = 'docker' | 'nginx' | 'certbot' | 'postfix' | 'dovecot' | 'ufw' | 'git' | 'npm';

interface ToolConfig {
    binary: string; // Command to check (e.g. 'docker')
    packages: string[]; // Packages to install (e.g. ['docker.io', 'docker-compose-v2'])
    checkArgs?: string[]; // Args to check version (default ['--version'])
}

const TOOLS: Record<ToolName, ToolConfig> = {
    docker: {
        binary: 'docker',
        packages: ['docker.io', 'docker-compose-v2', 'docker-buildx'],
    },
    nginx: {
        binary: 'nginx',
        packages: ['nginx'],
        checkArgs: ['-v']
    },
    certbot: {
        binary: 'certbot',
        packages: ['certbot', 'python3-certbot-nginx'],
    },
    postfix: {
        binary: 'postfix',
        packages: ['postfix', 'libsasl2-modules'],
        checkArgs: ['status'] // postfix status returns info
    },
    dovecot: {
        binary: 'dovecot',
        packages: ['dovecot-core', 'dovecot-imapd', 'dovecot-pop3d'],
    },
    ufw: {
        binary: 'ufw',
        packages: ['ufw'],
    },
    git: {
        binary: 'git',
        packages: ['git'],
    },
    npm: {
        binary: 'npm',
        packages: ['npm'],
    }
};

export const checkDependency = async (tool: ToolName): Promise<boolean> => {
    const config = TOOLS[tool];
    try {
        await execa(config.binary, config.checkArgs || ['--version']);
        return true;
    } catch (e: any) {
        // Some tools return non-zero on --version or behave differently, but usually 'command not found' throws ENOENT
        if ((e.code === 'ENOENT') || (e.message && e.message.includes('not found'))) {
            return false;
        }
        // If it executes but errors, it might still be installed (e.g. postfix status needs sudo)
        // If error is 'command not found', it's definitely missing.
        // We will assume installed if we found the binary but it complained about permissions.
        return true;
    }
};

export const installDependency = async (tool: ToolName) => {
    const config = TOOLS[tool];
    log.info(`Auto-installing ${tool} and dependencies: ${config.packages.join(', ')}...`);

    if (IS_WINDOWS) {
        log.warn(`Cannot auto-install ${tool} on Windows. Please install manually.`);
        return;
    }

    try {
        // Update package list first to ensure we get latest
        // await execa('sudo', ['apt-get', 'update'], { stdio: 'inherit' }); 
        // Logic to detect pkg manager could be here, defaulting to apt for now as per system.ts

        await execa('sudo', ['apt-get', 'update'], { stdio: 'inherit' });
        await execa('sudo', ['apt-get', 'install', '-y', ...config.packages], { stdio: 'inherit' });

        log.success(`Successfully installed ${tool}.`);
    } catch (e: any) {
        log.error(`Failed to install ${tool}: ${e.message}`);
        throw e;
    }
};

export const ensureDependency = async (tool: ToolName) => {
    log.info(`Checking dependency: ${tool}...`);
    const exists = await checkDependency(tool);

    if (exists) {
        log.info(`${tool} is already installed.`);
        return;
    }

    log.warn(`${tool} is missing.`);
    if (IS_LINUX) {
        try {
            await installDependency(tool);

            // Verify
            if (await checkDependency(tool)) {
                log.success(`${tool} is now ready.`);
            } else {
                throw new Error(`${tool} installation appeared to succeed but binary is not found.`);
            }
        } catch (e) {
            log.error(`Could not satisfy dependency ${tool}. Aborting.`);
            process.exit(1);
        }
    } else {
        log.error(`Missing required tool: ${tool}. Please install it manually.`);
        // Don't exit on windows simulation, just warn? Or exit?
        // For simulation purposes, we might want to continue.
        log.warn('(Simulation) Proceeding as if installed...');
    }
};
