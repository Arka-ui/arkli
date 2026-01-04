import { IS_LINUX } from './system.js';

export const generateRoundcubeCompose = (projectName: string, port: number) => {
    // We use a simple SQLite setup for Roundcube to keep it lightweight, 
    // or MariaDB if robustness is needed. For personal servers, MariaDB/MySQL is standard for Roundcube.

    // extra_hosts logic to allow container to talk to host Postfix/Dovecot
    const extraHosts = IS_LINUX
        ? `extra_hosts:\n      - "host.docker.internal:host-gateway"`
        : `extra_hosts:\n      - "host.docker.internal:host-gateway"`;

    return `version: '3.8'

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
