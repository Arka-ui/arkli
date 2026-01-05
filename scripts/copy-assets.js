import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const clientDist = path.join(rootDir, 'src/dashboard/client/dist');
const targetDist = path.join(rootDir, 'dist/dashboard/client/dist');

async function copyAssets() {
    console.log('Copying Dashboard Client to dist...');
    try {
        if (await fs.pathExists(clientDist)) {
            await fs.copy(clientDist, targetDist, { overwrite: true });
            console.log('Success!');
        } else {
            console.warn(`Warning: Client build not found at ${clientDist}. Did you run "npm run build" in dashboard/client?`);
        }
    } catch (e) {
        console.error('Failed to copy assets:', e);
        process.exit(1);
    }
}

copyAssets();
