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

- **📱 Connecting from iPhone / Android (QR Code & LAN IP)**:
  - When running inside Docker, Docker assigns internal bridge IPs (like `172.18.0.2`). **External mobile devices on your Wi-Fi cannot connect to this internal Docker IP.**
  - **Option A (In Web UI)**: Open `http://localhost:4321` on your PC, navigate to the **"Open on Mobile / Tablet"** QR card, enter your PC's Wi-Fi IPv4 address (e.g. `192.168.1.50`) into the **Host IP** field, and click **Set IP**. The QR code updates immediately.
  - **Option B (In `.env` File)**: Create or edit `.env` in the project root:
    ```env
    LAN_IP=192.168.1.50
    ```
    Then restart the stack with `docker compose down && docker compose up -d`.
  - **iOS Safari SSL Warning**: When opening `https://<server-ip>:4323` on iPhone/iPad with a self-signed certificate, Safari displays _"This Connection Is Not Private"_. Tap **Show Details** at the bottom, then tap **"visit this website"** to proceed and allow camera permissions.

### 4. Administrator Account & User Management

A default administrator account is automatically initialized on server startup:

- **Login URL**: `http://localhost:4321/login` (or `http://<server-ip>:4321/login`)
- **Username / Email**: `admin`
- **Password**: `TPrompt123`

#### 👑 Admin Panel (`/admin`)

Log in with the admin credentials above, then navigate to `/admin` (or click **Admin Panel** in the top navigation):

- **Manage Users Tab**:
  - **View Accounts**: See all registered users, roles, and how many scripts and recordings each user owns.
  - **Change Roles**: Promote users to `Admin` or demote to `User` directly via dropdown.
  - **Reset Passwords**: Set a new password for any user account instantly.
  - **Add Users**: Create new user accounts directly from the admin dashboard.
  - **Delete Users**: Remove users (with safeguards to prevent deleting your own active admin account).
- **Shared Scripts & Folders Tab**: Organize scripts into shared categories and team folders.
- **Server Recordings Tab**: Preview, stream, download, or delete recording files stored on the server.

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

| Issue                                                    | Cause                                                                                                                      | Solution                                                                                                                                                                               |
| :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **QR code shows `172.18.0.2` and iPhone cannot connect** | `172.18.0.2` is Docker's internal virtual bridge IP. Mobile devices on your Wi-Fi cannot route to Docker internal subnets. | Find your PC's Wi-Fi IP using `ipconfig` (e.g. `192.168.1.50`). Enter it into the **Host IP** box on the web UI or set `LAN_IP=192.168.1.50` in `.env` and restart Docker.             |
| **iOS Safari says "This Connection Is Not Private"**     | The local HTTPS gateway on port 4323 uses a self-signed development SSL certificate.                                       | In iOS Safari, tap **Show Details** at the bottom of the error page, then tap **"visit this website"** to proceed.                                                                     |
| **Cannot reach server from another device (Timeout)**    | Windows Firewall is blocking inbound connections on ports 4321/4323.                                                       | Run the firewall PowerShell rule provided above: `New-NetFirewallRule -DisplayName "Teleprompter Server" -Direction Inbound -LocalPort 80,4321,4322,4323 -Protocol TCP -Action Allow`. |
| **Phone and PC cannot communicate**                      | Devices are on different networks, cellular data, or Wi-Fi AP Isolation is enabled.                                        | Ensure phone and PC are on the same Wi-Fi SSID (disable mobile data while testing). Check router settings to ensure "AP Isolation" or "Guest Mode" is turned off.                      |
| **Port 80 is already in use**                            | Windows IIS or Skype/system service is listening on port 80.                                                               | Edit `docker-compose.yml` under `teleprompter` ports from `'80:8080'` to `'8000:8080'`, or stop IIS using `iisreset /stop`.                                                            |
| **Mobile camera permission blocked**                     | Non-localhost HTTP blocks camera access on iOS/Android.                                                                    | Connect via `https://<server-ip>:4323` (port 4323 HTTPS Gateway) instead of HTTP.                                                                                                      |
| **Recordings upload fails**                              | File exceeds maximum body size.                                                                                            | Nginx is configured for `500M` max body size with unbuffered streaming; check available disk space on server.                                                                          |
