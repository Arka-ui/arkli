import fs from 'fs-extra';
import path from 'path';
import { log } from './logger.js';
import { getProject, getHomeDir } from './system.js'; // Need to export getRegistryPath or make a new getter?
// We'll read registry directly or add helper in system.ts. Let's assume we add getNextAvailablePort in system.

export const generateDockerConfig = async (projectName: string, projectPath: string, dataPath: string, port: number) => {
    log.info(`Generating Docker configuration for ${projectName} on port ${port}...`);

    // 1. Dockerfile (Generic Node/Next.js)
    const dockerfileContent = `
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build (if applicable, ignores error if no build script)
RUN npm run build --if-present

# Environment variables will be loaded from the mounted .env file passed by docker-compose
# But typically we want the app to read .env at runtime or build time.
# For runtime, we mount it.

EXPOSE ${port}

ENV PORT=${port}
CMD ["npm", "start"]
`;

    // 2. Docker Compose
    // Mounts:
    // - Isolated .env -> /app/.env
    // - Isolated db -> /app/prisma/dev.db (or wherever it matches?)
    // This is tricky: "auto detect database and move itself".
    // If we moved it to `dataPath/db/dev.db`, we need to mount it back to where the app expects it.
    // We assume the app expects it in `prisma/dev.db` or root `dev.db`.
    // We will trust the User Logic: if 'move' symlinked it, the container sees the symlink?
    // Symlinks inside docker from host are tricky. Better to mount the isolate file directly to the expected path.
    // For now, let's mount the ENTIRE env folder content to .env.

    // Config: relative paths in compose might be weird if running global command.
    // We must write absolute paths or ensure context is correct.

    const composeContent = `
services:
  app:
    build: .
    container_name: ${projectName}
    restart: always
    ports:
      - "${port}:${port}"
    volumes:
      - "${dataPath.replace(/\\/g, '/')}/env/.env:/app/.env"
      # Mount Database folder? 
      # Simplification: Mount the specific DB file if we know it. 
      # Since 'move' logic handled specific files, we might need a dynamic list.
      # For now, let's leave DB mounting manual or assume standard sqlite path if desired.
      # Better approach: Mount the DATA dir to a known location and tell app to use it via ENV?
      # But user wants "simply init".
      # Let's rely on the .env being mounted. The .env usually contains DATABASE_URL=file:/path.
      # That path must exist in container.
      # We'll mount dataPath/db -> /app/db (and hope user config pointing there?)
      # This is the "Monitoring/Isolation" part that is hard to generalize without constraints.
      # We'll mount the whole dataPath to /data inside container for flexibility.
      - "${dataPath.replace(/\\/g, '/')}:/data"
    environment:
      - PORT=${port}
      # We might need to override DATABASE_URL to point to /data/db/...
`;

    await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfileContent.trim());
    await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), composeContent.trim());

    log.success(`Docker config created. Assigned Port: ${port}`);
};
