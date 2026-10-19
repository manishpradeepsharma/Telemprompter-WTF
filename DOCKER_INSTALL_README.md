# Docker Compose Deployment Guide (Windows 11 Server & Linux)

This guide explains how to deploy the Teleprompter full-stack application using Docker Compose on a **Windows 11 Server** (or any Windows/Linux/macOS host with Docker).

---

## 🏗️ Architecture Overview

The application runs as two coordinated containers defined in `docker-compose.yml`:

1. **`teleprompter-api` (`api`)**:
   - Lightweight Node.js 24 Alpine runtime (`server/index.mjs`).
   - SQLite database (`teleprompter.sqlite`) stored persistently in `./data`.
   - Video recording storage stored persistently in `./filestore`.
   - Runs automated health check at `http://127.0.0.1:4322/api/health`.
   - Optional HTTPS Mobile Gateway on port `4323` for mobile camera permissions.

2. **`teleprompter-web` (`teleprompter`)**:
   - Production-optimized, unprivileged Nginx container (`nginxinc/nginx-unprivileged:1.29-alpine`).
   - Serves the pre-rendered static Astro web application, local AI models, and assets.
   - Reverse-proxies `/api/` and `/filestore/` to `teleprompter-api` without buffering so large video uploads stream seamlessly.
   - Automatically waits until `api` is healthy before serving traffic.

---

## 📋 Prerequisites on Windows 11 Server

1. **Install Docker Desktop**:
   - Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
   - Ensure the **WSL 2 backend** option is selected during setup.
2. **Start Docker Desktop** and wait until the status indicator turns green (`Engine running`).
3. **Open PowerShell as Administrator** or Windows Terminal.

---

## 🚀 Quick Start Deployment

Navigate to the project root directory:

```powershell
cd C:\path\to\Teleprompter-WTF
```

### 1. Build and Start the Stack

```powershell
docker compose up -d --build
```

### 2. Verify Container Health

```powershell
docker compose ps
```

You should see both services running and healthy:

```text
NAME               IMAGE                  STATUS                    PORTS
teleprompter-api   teleprompter-wtf-api   Up (healthy)              0.0.0.0:4322->4322/tcp, 0.0.0.0:4323->4323/tcp
teleprompter-web   teleprompter-wtf-web   Up (healthy)              0.0.0.0:80->8080/tcp, 0.0.0.0:4321->8080/tcp, 0.0.0.0:8080->8080/tcp
```

### 3. Accessing the Application

- **Locally on the Windows 11 Server**:
  - `http://localhost` (standard HTTP port 80)
  - `http://localhost:4321` (Astro default port)
  - `http://localhost:8080` (compatible with test automation)

- **From other PCs or Phones on the Local Network (LAN)**:
  1. Find your Windows Server's local IP address:
     ```powershell
     ipconfig
     ```
     _(Look for the IPv4 Address under your active Wi-Fi or Ethernet adapter, e.g., `192.168.1.50`)_
  2. From any laptop, tablet, or phone on the same Wi-Fi/LAN:
     - Open: `http://192.168.1.50` or `http://192.168.1.50:4321`

- **Mobile Camera Recording (HTTPS Gateway)**:
  - Mobile browsers (Safari/Chrome) require HTTPS to allow camera permissions when accessing non-localhost IP addresses.
  - Access: `https://192.168.1.50:4323`
  - _(Ensure certificates exist in the `./ssl` directory: `cert.pem` and `key.pem`)_.

---

## 🛡️ Windows Defender Firewall Rule (For LAN Access)

If devices on your local network cannot connect to your Windows 11 server, open PowerShell as **Administrator** and run this command once to allow inbound connections:

```powershell
New-NetFirewallRule -DisplayName "Teleprompter Server" -Direction Inbound -LocalPort 80,4321,4322,4323 -Protocol TCP -Action Allow
```

---

## 💾 Persistent Storage & Backup

All data is stored directly on your host machine so nothing is lost when containers restart or update:

- **Database**: `./data/teleprompter.sqlite` (User accounts, folders, scripts, metadata)
- **Recordings**: `./filestore/` (Uploaded video and audio recordings)
- **SSL Certificates**: `./ssl/` (`cert.pem`, `key.pem`)

To back up your entire server, simply copy the `./data` and `./filestore` folders.

---

## 🛠️ Management & Maintenance Commands

### View Live Logs

```powershell
docker compose logs -f
```

Or for a specific service:

```powershell
docker compose logs -f api
docker compose logs -f teleprompter
```

### Stop the Containers

```powershell
docker compose down
```

### Restart the Stack

```powershell
docker compose restart
```

### Update and Rebuild After Pulling Code

```powershell
git pull
docker compose up -d --build
```

---

## 🔍 Troubleshooting

| Issue                                       | Cause                                                       | Solution                                                                                                                   |
| :------------------------------------------ | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **Port 80 is already in use**               | Windows IIS or Skype/system service is listening on port 80 | Edit `docker-compose.yml` under `teleprompter` ports from `'80:8080'` to `'8000:8080'`, or stop IIS using `iisreset /stop` |
| **Mobile camera permission blocked**        | Non-localhost HTTP blocks camera access on iOS/Android      | Connect via `https://<server-ip>:4323` or install local certificates in `./ssl`                                            |
| **Cannot reach server from another device** | Windows Firewall is blocking inbound connections            | Run the firewall PowerShell rule provided above                                                                            |
| **Recordings upload fails**                 | File exceeds maximum body size                              | Nginx is configured for `500M` max body size with unbuffered streaming; check available disk space on server               |
