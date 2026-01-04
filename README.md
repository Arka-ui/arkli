# Arkli - Personal Server Management CLI

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

**Arkli** is a robust agentic CLI tool designed to simplify the hosting, management, security, and communications of websites on your personal server. By leveraging **Docker** for containerization and **Nginx** for automated reverse proxying, Arkli ensures each of your projects is secure, isolated, and accessible with zero hassle.

It now includes a fully-featured **Mail Server Manager** (Postfix/Dovecot) to handle emails for your domains seamlessly.

---

## 🚀 Key Features

*   **⚡ Instant Scaffolding**: initialize projects with auto-generated `Dockerfile` and `docker-compose.yml`.
*   **🧠 Environment Intelligence**: Automatically detects missing tools (Docker, Nginx, etc.) and installs them for you.
*   **🚑 Self-Healing Diagnostics**: Automatically analyzes failure logs (like failed Dovecot restarts) and suggests fixes.
*   **🔒 Complete Isolation**: Sensitive data (`.env`, databases) is automatically moved to a "Brain" directory, keeping your codebase clean and safe.
*   **🐳 Docker Architecture**: Every project runs in its own container with automatically assigned unique ports.
*   **🌐 Auto-Configuration**: Automatically generates and applies Nginx reverse proxy configurations for your custom domains.
*   **📧 Full Mail Stack**: Automates the setup of Postfix/Dovecot with SSL, DKIM, and SPF support.
*   **🔄 Self-Update**: Keep your server secure and up-to-date with a single command (`arkli update`).
*   **🔐 SSL Management**: Integrated wrapper for Certbot to manage SSL certificates easily.
*   **🔄 Database Migrations**: Unified command to run migrations across different tech stacks.

---

## 🛠 Installation

### Prerequisites
*   Node.js >= 18
*   Docker & Docker Compose
*   Nginx (for reverse proxy)
*   Let's Encrypt / Certbot (for SSL)

### Install via NPM
```bash
git clone https://github.com/Arka-ui/arkli.git
cd arkli
npm install
npm run build
npm link
```
*Now you can use the `arkli` command globally.*

---

## 📖 Command Reference

### Core Management

#### `arkli init <project_name>`
Initializes a new project with the standard Arkli structure.
*   **Creates**: `~/project_name` (Code) and `~/.arkli/data/project_name` (Data).
*   **Generates**: `Dockerfile`, `docker-compose.yml`, `.env`.
*   **Auto-Installs**: Docker & Docker Compose if missing.

#### `arkli move <project_name>`
Migrates an *existing* project in the current directory into the Arkli structure.
*   Safely separates your code from your data.

#### `arkli delete -n <project_name>`
**⚠️ DESTRUCTIVE**: Completely removes a project from the system.
*   Stops and removes all Docker containers.
*   Deletes Nginx configurations and SSL certificates.
*   Removes system mail users and cleans Postfix maps.
*   Permanently deletes all files and data.
*   use `--force` to skip confirmation.

#### `arkli update`
Self-updates Arkli to the latest version and performs system-wide security updates (`apt-get upgrade`) to keep your server safe.

---

### 🌐 Web & Domain

#### `arkli link -d <domain> -n <project_name>`
Exposes your project to the internet via Nginx.
*   Generates an Nginx reverse proxy configuration.
*   Reloads Nginx.
*   Auto-installs Nginx if missing.

#### `arkli cert setup <domain>`
Secures a domain with a generic Let's Encrypt SSL certificate using Certbot.
*   Auto-renews automatically.

---

### 📧 Mail Server

#### `arkli mail setup -n <project_name>`
Turns your server into a full-featured mail server for the project's domain.
*   Installs Postfix & Dovecot.
*   Configures SSL/TLS, SASL Authentication, and Maildir.
*   **Auto-Heals**: Automatically fixes common errors (like missing SSL).

#### `arkli mail create <user> -n <project_name>`
Creates a new email address (e.g., `contact@...`).
*   Maps the email to a secure, isolated system user.
*   Updates Postfix virtual alias maps.

#### `arkli mail info <user> -n <project_name>`
Displays connection details for your mail clients (Outlook, Apple Mail, etc.).
*   Shows SMTP/IMAP hostnames, ports, and usernames.

#### `arkli mail dns -n <project_name>`
Shows the exact DNS records you need to add to your domain registrar.
*   Includes **MX**, **SPF**, **DMARC**, and **DKIM** records.

#### `arkli mail verify -n <project_name>`
Checks the health of your mail server services (Postfix/Dovecot).

#### `arkli mail webmail install -n <project_name>`
**✨ NEW**: Deploys a **Roundcube** webmail panel for your project.
*   **URL**: Default is `https://webmail.yourdomain.com`.
*   Includes full SSL and Nginx setup automatically.

---

### 🛠 Tools & Utilities

#### `arkli monitor`
Displays a dashboard of your server's health.
*   Lists all running Docker containers.
*   Shows CPU/Memory usage.
*   Lists active ports.

#### `arkli migrate`
Helps run database migrations for your projects (Context-aware).

---

## 📂 Architecture

Arkli uses a "Split-Brain" architecture to enhance security:

| Path | Description |
| :--- | :--- |
| **`~/YourProject/`** | **Stateless Code**. Contains your application code, `Dockerfile`, and `arkli.json`. Safe to commit to Git. |
| **`~/.arkli/data/`** | **Stateful Data**. Contains `.env` files, SQLite databases, and sensitive config. Never committed. |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
