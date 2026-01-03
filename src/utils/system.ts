import os from 'os';
import path from 'path';
import { log } from './logger.js';
import { execa } from 'execa';
import fs from 'fs-extra';

export const IS_WINDOWS = os.platform() === 'win32';
export const IS_LINUX = os.platform() === 'linux';

export const getHomeDir = () => os.homedir();

export const getDataDir = (projectName: string) => {
    // Isolated data directory strategy
    // Windows: C:\Users\<User>\.arkli\data\<project>
    // Linux: /var/lib/arkli/<project> (if root) or ~/.arkli/data/<project>

    if (IS_WINDOWS) {
        return path.join(getHomeDir(), '.arkli', 'data', projectName);
    } else {
        return path.join(getHomeDir(), '.arkli', 'data', projectName);
    }
};

const getRegistryPath = () => path.join(getHomeDir(), '.arkli', 'projects.json');

export const registerProject = async (name: string, projectPath: string, dataPath: string) => {
    const registryPath = getRegistryPath();
    await fs.ensureFile(registryPath);
    let registry: Record<string, any> = {};
    try {
        registry = await fs.readJson(registryPath);
    } catch (e) {
        // ignore if empty/missing
    }

    registry[name] = { projectPath, dataPath, createdAt: new Date().toISOString() };
    await fs.writeJson(registryPath, registry, { spaces: 2 });
};

export const updateProjectDomain = async (name: string, domain: string) => {
    const registryPath = getRegistryPath();
    let registry: Record<string, any> = {};
    try {
        registry = await fs.readJson(registryPath);
    } catch (e) { return; }

    if (registry[name]) {
        registry[name].domain = domain;
        await fs.writeJson(registryPath, registry, { spaces: 2 });
    }

    // Also update local arkli.json
    const project = await getProject(name);
    if (project) {
        const configPath = path.join(project.projectPath, 'arkli.json');
        if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            config.domain = domain;
            await fs.writeJson(configPath, config, { spaces: 2 });
        }
    }
};

export const getProject = async (name: string) => {
    const registryPath = getRegistryPath();
    try {
        const registry = await fs.readJson(registryPath);
        return registry[name] || null;
    } catch (e) {
        return null;
    }
};

export const ensureProjectStructure = async (projectName: string) => {
    const projectPath = path.resolve(process.cwd(), projectName);
    const dataPath = getDataDir(projectName);

    try {
        if (await fs.pathExists(projectPath)) {
            throw new Error(`Project directory ${projectPath} already exists.`);
        }

        // Create Web Project Dir
        await fs.ensureDir(projectPath);
        log.info(`Created project directory: ${projectPath}`);

        // Create Isolated Data Dir
        await fs.ensureDir(dataPath);
        log.info(`Created isolated data directory: ${dataPath}`);

        // Create subdirs in data
        await fs.ensureDir(path.join(dataPath, 'db'));
        await fs.ensureDir(path.join(dataPath, 'env'));

        // Create a config file in project to point to data
        const config = {
            name: projectName,
            dataPath: dataPath,
            createdAt: new Date().toISOString()
        };

        await fs.writeJson(path.join(projectPath, 'arkli.json'), config, { spaces: 2 });

        // Register globally
        await registerProject(projectName, projectPath, dataPath);

        log.success(`Project initialized. Config stored in arkli.json`);

        return { projectPath, dataPath };
    } catch (error: any) {
        log.error(`Failed to initialize project: ${error.message}`);
        throw error;
    }
};

export const installPackage = async (packageName: string) => {
    if (IS_WINDOWS) {
        log.warn(`Auto-installing ${packageName} on Windows is not fully supported. Please install manually.`);
        return;
    }

    try {
        // Detect apt or yum
        // Simple check: try apt-get
        try {
            await execa('which', ['apt-get']);
            log.info(`Installing ${packageName} via apt-get...`);
            await execa('sudo', ['apt-get', 'install', '-y', packageName], { stdio: 'inherit' });
            return;
        } catch (e) {
            // Check yum
            try {
                await execa('which', ['yum']);
                log.info(`Installing ${packageName} via yum...`);
                await execa('sudo', ['yum', 'install', '-y', packageName], { stdio: 'inherit' });
                return;
            } catch (e2) {
                log.error(`No supported package manager found (apt/yum). Cannot install ${packageName}.`);
            }
        }
    } catch (error: any) {
        log.error(`Failed to install ${packageName}: ${error.message}`);
    }
};

export const checkAndInstallUFW = async () => {
    if (IS_LINUX) {
        await installPackage('ufw');
        // Enable? 
        // await execa('sudo', ['ufw', 'enable'], { stdio: 'inherit' });
    }
};
