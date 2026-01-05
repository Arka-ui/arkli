import fs from 'fs-extra';
import path from 'path';
import { log } from '../utils/logger.js';
import { IS_LINUX } from '../utils/system.js';

export const generateDockerConfig = async (projectName: string, projectPath: string, dataPath: string, port: number) => {
  log.info(`[Core] Generating Docker configuration for ${projectName} on port ${port}...`);

  // 1. Dockerfile (Generic Node/Next.js)
  const dockerfileContent = `
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build (if applicable)
RUN npm run build --if-present

EXPOSE ${port}

ENV PORT=${port}
CMD ["npm", "start"]
`;

  // 2. Docker Compose
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
      - "${dataPath.replace(/\\/g, '/')}:/data"
    environment:
      - PORT=${port}
`;

  await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfileContent.trim());
  await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), composeContent.trim());

  log.success(`[Core] Docker config created. Assigned Port: ${port}`);
};

export const generateRoundcubeCompose = (projectName: string, port: number) => {
  // We use a simple SQLite setup for Roundcube to keep it lightweight, 
  // or MariaDB if robustness is needed. For personal servers, MariaDB/MySQL is standard for Roundcube.

  // extra_hosts logic to allow container to talk to host Postfix/Dovecot
  const extraHosts = IS_LINUX
    ? `extra_hosts:\n      - "host.docker.internal:host-gateway"`
    : `extra_hosts:\n      - "host.docker.internal:host-gateway"`;

  return `
services:
  roundcube-db:
    image: mariadb:10.5
    container_name: ${projectName}_roundcube_db
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=roundcube_root_pwd
      - MYSQL_DATABASE=roundcube
      - MYSQL_USER=roundcube
      - MYSQL_PASSWORD=roundcube_pwd
    volumes:
      - ./db:/var/lib/mysql

  roundcube:
    image: roundcube/roundcubemail:latest
    container_name: ${projectName}_roundcube
    restart: always
    depends_on:
      - roundcube-db
    ports:
      - "${port}:80"
    environment:
      - ROUNDCUBEMAIL_DB_TYPE=mysql
      - ROUNDCUBEMAIL_DB_HOST=${projectName}_roundcube_db
      - ROUNDCUBEMAIL_DB_USER=roundcube
      - ROUNDCUBEMAIL_DB_PASSWORD=roundcube_pwd
      - ROUNDCUBEMAIL_DB_NAME=roundcube
      - ROUNDCUBEMAIL_DEFAULT_HOST=tls://host.docker.internal
      - ROUNDCUBEMAIL_DEFAULT_PORT=587
      - ROUNDCUBEMAIL_SMTP_SERVER=tls://host.docker.internal
      - ROUNDCUBEMAIL_SMTP_PORT=587
      - ROUNDCUBEMAIL_PLUGINS=archive,zipdownload
    ${extraHosts}
`;
};
