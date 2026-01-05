import { log } from '../utils/logger.js';

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    dockerfile: (port: number) => string;
    compose: (port: number, dataPath: string) => string;
    envVars: Record<string, string>;
}

export const templates: Record<string, ProjectTemplate> = {
    'nextjs': {
        id: 'nextjs',
        name: 'Next.js App',
        description: 'Standard Next.js Application with Node 18',
        envVars: {},
        dockerfile: (port) => `
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build --if-present
EXPOSE ${port}
ENV PORT=${port}
CMD ["npm", "start"]
`,
        compose: (port, dataPath) => `
services:
  app:
    build: .
    restart: always
    ports:
      - "${port}:${port}"
    volumes:
      - "${dataPath.replace(/\\/g, '/')}/env/.env:/app/.env"
      - "${dataPath.replace(/\\/g, '/')}:/data"
    environment:
      - PORT=${port}
`
    },
    'wordpress': {
        id: 'wordpress',
        name: 'WordPress',
        description: 'World\'s most popular CMS',
        envVars: {
            'WORDPRESS_DB_HOST': 'db',
            'WORDPRESS_DB_USER': 'wordpress',
            'WORDPRESS_DB_PASSWORD': 'password', // Should generate random in real logic
            'WORDPRESS_DB_NAME': 'wordpress'
        },
        dockerfile: (port) => `
FROM wordpress:latest
# WordPress default is 80, we might need custom config to change it or just map it
`,
        compose: (port, dataPath) => `
services:
  db:
    image: mysql:5.7
    volumes:
      - "${dataPath.replace(/\\/g, '/')}/db_data:/var/lib/mysql"
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: password

  app:
    image: wordpress:latest
    depends_on:
      - db
    ports:
      - "${port}:80"
    restart: always
    volumes:
      - "${dataPath.replace(/\\/g, '/')}/wp_content:/var/www/html/wp-content"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: password
      WORDPRESS_DB_NAME: wordpress
`
    },
    'ghost': {
        id: 'ghost',
        name: 'Ghost Blog',
        description: 'Professional publishing platform',
        envVars: {
            'url': 'http://localhost'
        },
        dockerfile: (port) => `FROM ghost:latest`,
        compose: (port, dataPath) => `
services:
  app:
    image: ghost:latest
    restart: always
    ports:
      - "${port}:2368"
    volumes:
      - "${dataPath.replace(/\\/g, '/')}/ghost_content:/var/lib/ghost/content"
    environment:
      - url=http://localhost:${port}
`
    }
};

export function getTemplate(id: string): ProjectTemplate | null {
    return templates[id] || null;
}
