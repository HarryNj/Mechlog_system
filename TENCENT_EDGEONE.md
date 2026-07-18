# Tencent Cloud EdgeOne Deployment Guide

This guide details how to build and deploy your full-stack React + Express + PostgreSQL + Socket.io application using **Tencent Cloud EdgeOne** (Teo) as your security, acceleration, and edge-handling layer.

---

## Architecture Overview

Because this application is **full-stack** (including a Node.js Express server, live Socket.io WebSockets, and database persistence), it cannot run as a pure static site. The recommended production architecture on Tencent Cloud is:

```
[ User Browser ] 
       │
       ▼ (Anycast DNS, DDoS Protection, Web Application Firewall)
[ Tencent Cloud EdgeOne ]
       │
       ├──► Dynamic / Real-time: Forward to Origin Server (Lighthouse, CVM, or TCBR container)
       └──► Static Assets: Cached at EdgeOne Edge Nodes
```

---

## Step 1: Package Your Application (Docker)

We have created a production-ready `Dockerfile` in your root folder. This uses a multi-stage build to compile Vite static assets and bundle the Express server into `dist/server.cjs` efficiently.

To build the image locally or in your CI/CD:
```bash
docker build -t my-app:latest .
```

---

## Step 2: Deploy Your Origin Server in Tencent Cloud

You have two primary options for running the backend and database:

### Option A: Tencent Cloud Base Run (TCBR) - *Recommended*
TCBR (Tencent Cloud serverless container hosting) is the easiest way to run the full-stack container.
1. Go to the [Tencent Cloud Base Run (TCBR) Console](https://console.cloud.tencent.com/tcbr).
2. Create a new environment, select **Container Deployment**, and upload your built image or connect to your Git repository.
3. Set your container port to `3000`.
4. Configure your environment variables (e.g. `DATABASE_URL`, `GEMINI_API_KEY`, and Firebase Auth details) in the container settings.

### Option B: Lighthouse (輕量應用服務器) or CVM (雲服務器)
1. Launch a Node.js-compatible VM in the Tencent Cloud console.
2. Install Node.js, Git, PM2, and your preferred PostgreSQL instance (or connect to **TencentDB for PostgreSQL**).
3. Clone your code, run `npm install` and `npm run build`.
4. Use PM2 to run the server persistently:
   ```bash
   NODE_ENV=production PORT=3000 pm2 start dist/server.cjs --name my-app
   ```

---

## Step 3: Configure Tencent Cloud EdgeOne

Once your origin server is running and accessible via an IP address or a raw service domain, configure EdgeOne:

### 1. Add your Domain to EdgeOne
1. Log in to the [Tencent Cloud EdgeOne Console](https://console.tencentcloud.com/edgeone).
2. Click **Add Site**, enter your custom domain (e.g., `app.yourdomain.com`), and select your billing plan.
3. Configure your DNS resolution: Point your Domain NS (Name Server) to EdgeOne's assigned NS, or configure a CNAME record if using CNAME access.

### 2. Configure the Origin Group
1. In the EdgeOne sidebar, navigate to **Origin Groups** -> **Create Origin Group**.
2. Set **Origin Type** to `IP/Domain` (depending on where your origin server is hosted).
3. Enter your Origin Server's IP address or the raw domain (e.g. TCBR/Lighthouse domain) and set the Port to `80` or `443` (EdgeOne will forward traffic to this backend).

### 3. Enable WebSocket Support (CRITICAL)
Since your application relies on **Socket.io** for real-time notifications and synchronized actions:
1. In the EdgeOne Console, go to **Rule Engine** (or **Edge Functions** / **Origin Configuration**).
2. Find **WebSockets Upgrade** or **HTTP Upgrade Headers** policy and ensure it is **Enabled**. 
3. This allows the connection upgrade headers (`Upgrade: websocket` and `Connection: Upgrade`) to pass through the CDN edge to your Node.js backend.

### 4. Optimize Caching Rules (Page Rules)
To make your application load incredibly fast worldwide, cache static assets while passing through dynamic requests:

Create the following rule hierarchy under **Rule Engine**:

| Rule Condition (URL Path) | Action / Cache Configuration | Description |
| :--- | :--- | :--- |
| `/api/*` | **Bypass Cache** (No Cache) | Ensures database CRUD operations are always fresh. |
| `/socket.io/*` | **Bypass Cache** | Prevents proxying issues with your WebSocket connection. |
| `/assets/*` | **Cache** (e.g., 30 Days) | Caches CSS, JS bundles, and compiled images at EdgeOne edge nodes. |
| `/*` (Fallback / HTML) | **Bypass Cache** (or Cache with short TTL like 5m) | Serves the main index.html container. |

---

## Step 4: Secure Your Site with HTTPS and WAF

1. Under **Certificates & Security**, request or upload an SSL certificate for your custom domain so that EdgeOne can handle full HTTPS handshakes at the edge.
2. Turn on the **WAF (Web Application Firewall)** and **DDoS Mitigation** to shield your origin database/application from malicious traffic, SQL injection attempts, and bot attacks.
