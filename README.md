# Arkli - Personal Server Management CLI

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

**Arkli** is a robust CLI tool designed to simplify the hosting, management, and security of websites on your personal server. By leveraging **Docker** for containerization and **Nginx** for automated reverse proxying, Arkli ensures each of your projects is secure, isolated, and accessible with zero hassle.

---

## 🚀 Key Features

*   **⚡ Instant Scaffolding**: initialize projects with auto-generated `Dockerfile` and `docker-compose.yml`.
*   **🔒 Complete Isolation**: Sensitive data (`.env`, databases) is automatically moved to a secure, isolated directory, keeping your codebase clean and safe.
*   **🐳 Docker Architecture**: Every project runs in its own container with automatically assigned unique ports.
*   **🌐 Auto-Configuration**: Automatically generates and applies Nginx reverse proxy configurations for your custom domains.
*   **📧 Mail Integration**: One-command setup for Postfix/Dovecot mail servers linked to your domains.
*   **🔐 SSL Management**: Integrated wrapper for Certbot to manage SSL certificates easily.

---

## 🛠 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/arkli.git
    cd arkli
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Build the Tool**:
    ```bash
    npm run build
    ```

4.  **Link Globally**:
    ```bash
    npm link
    ```
    *Now you can use the `arkli` command anywhere on your system.*

---

## 📖 Usage Guide

### 1️⃣ Initialize a Project
Create a new project structure with Docker support.
```bash
arkli init <project_name>
```

### 2️⃣ Secure & Move Files
Move your project files from a temporary source to the structured project directory, isolating sensitive files.
```bash
# Run this from the folder containing your source code
arkli move <project_name>
```

### 3️⃣ Start the Container
Bring your project online using Docker.
```bash
cd <project_name>
docker compose up -d
```

### 4️⃣ Link a Domain
Expose your project to the world by linking a domain and auto-configuring Nginx.
```bash
arkli link -d example.com -n <project_name>
```

### 5️⃣ Database Migration
Run database migrations (supports Prisma & npm scripts).
```bash
arkli migrate
```

### 6️⃣ Mail Server Setup
Configure a mail server for your linked project.
```bash
arkli mail setup -n <project_name>
arkli mail create info -n <project_name> # Creates info@example.com
```

### 7️⃣ Monitor Status
Check the health and stats of your running containers.
```bash
arkli monitor
```

---

## 📂 Architecture

| Path | Description |
| :--- | :--- |
| **Project Directory** | Contains your application code, `Dockerfile`, and `arkli.json`. |
| **`~/.arkli/data/`** | **Secure Storage**. Contains isolated `.env` files and databases. |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
