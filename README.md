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

## 📖 Detailed Usage Guide

### 1️⃣ Project Initialization
Create a new project structure. Arkli will ask for the project name and set up the directory.
```bash
arkli init <project_name>
```

### 2️⃣ Project Deployment
Move an existing project into the Arkli structure. This separates your code from your data (`.env`, `db`).
```bash
# From inside your source code folder
arkli move <project_name>
```

### 3️⃣ Domain Linking
Expose your project to the internet using Nginx.
```bash
arkli link -d example.com -n <project_name>
```
*This command creates an Nginx config file, reloads Nginx, and sets up a reverse proxy to your Docker container.*

### 4️⃣ Mail Server Config (New!)
Turn your server into a fully functional mail server.

**Step 1: Setup Infrastructure**
Installs Postfix/Dovecot and generates secure configurations (SSL/TLS, SASL).
```bash
arkli mail setup -n <project_name>
```

**Step 2: Create Email Accounts**
Maps an email address to a secure system user.
```bash
arkli mail create contact -n <project_name> 
# Creates contact@example.com
```

**Step 3: DNS Configuration**
View the exact DNS records (MX, SPF, DMARC) you need to add to your registrar.
```bash
arkli mail dns -n <project_name>
```

**Step 4: Verify Health**
Check if your mail services are active and running.
```bash
arkli mail verify -n <project_name>
```

### 5️⃣ SSL Certificates
Secure your site with HTTPS using Certbot.
```bash
arkli cert setup example.com
```

### 6️⃣ Monitoring
See what's running, port allocations, and container status.
```bash
arkli monitor
```

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
