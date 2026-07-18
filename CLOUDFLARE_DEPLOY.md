# Deploying to Cloudflare

This application is a **Full-Stack Application** with an Express.js backend API (`server.ts`), a PostgreSQL database integration layer, and a React frontend.

Because of the Express.js Node backend and the active TCP database pool, **this application cannot be deployed purely to Cloudflare Pages**, as Cloudflare Pages only supports static frontend sites.

## How to host using Cloudflare

To get the benefits of Cloudflare's edge network while supporting the robust backend, use the **Cloudflare Proxy** approach:

### 1. Deploy the Application Container
You need a host that supports full Docker containers or Node.js instances:
*   **Google Cloud Run** (Recommended, native to AI Studio)
*   **Render**
*   **Heroku** or **DigitalOcean App Platform**

**To Deploy on Google Cloud Run:**
1. Open the AI Studio **Deploy** menu in the top right.
2. Select **Deploy to Cloud Run**.
3. Follow the prompts to build your container and receive a `*.run.app` URL.

### 2. Connect Cloudflare
Once your app is hosted (e.g., on Cloud Run):
1. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Add your custom domain to Cloudflare.
3. Go to **DNS**.
4. Add a `CNAME` record pointing your domain (e.g., `app.yourdomain.com`) to your deployed backend URL (e.g., `your-app-xyz.run.app`).
5. Ensure the **Proxy status** cloud icon is **Orange** (Proxied).
6. Go to **SSL/TLS** -> Set the encryption mode to **Full (Strict)**.

Your app is now protected by Cloudflare's Web Application Firewall (WAF), Edge CDN caching, and DNS routing, while the heavy backend logic runs securely in a container engine!

### Alternative: Full Rewrite to Cloudflare Workers
If you absolutely must host *everything* directly on Cloudflare's edge servers (without Google Cloud Run), you would need to rewrite the backend:
1. Replace `express` with a web-standard framework like `Hono`.
2. Replace PostgreSQL connection pools with **Cloudflare D1** (Serverless SQL).
3. Deploy using `wrangler`.
*(Note: This requires significant code architectural changes).*
