# Deploying MechLog on Cloudflare Pages & Google Cloud Run

To achieve ultra-fast performance, low latency, and a custom domain configuration like **mechlog.com**, we recommend a **decoupled architecture**:
1. **Frontend (Vite + React SPA)**: Hosted on **Cloudflare Pages** for global CDN delivery, instant loads, and free static hosting.
2. **Backend (Express + Cloud SQL/Postgres)**: Hosted on **Google Cloud Run** to handle API routes, database connections, and secure logic.

Our app is fully pre-configured to support this architecture! We have enabled automatic cross-origin requests (CORS) on the backend and added a global API interceptor on the frontend.

---

## Step 1: Deploying the Frontend to Cloudflare Pages

Cloudflare Pages makes it easy to build and deploy static single-page apps.

### Option A: Direct Git Integration (Recommended)
1. Log in to your **Cloudflare Dashboard** and navigate to **Workers & Pages**.
2. Click **Create** > **Pages** > **Connect to Git**.
3. Select your repository.
4. Configure the **Build settings**:
   - **Framework preset**: `Vite` (or None)
   - **Build command**: `vite build` or `npm run build`
   - **Build output directory**: `dist`
5. Under **Environment Variables**, add:
   - **Variable Name**: `VITE_API_BASE_URL`
   - **Value**: Your Google Cloud Run backend service URL (e.g., `https://ais-dev-nirmkj3yoeyfseq4icue22-23626597169.europe-west2.run.app`)
6. Click **Save and Deploy**.

### Option B: Direct Upload via CLI / Drag-and-Drop
If you downloaded the package ZIP or want to deploy pre-built assets:
1. Run `npm install` and then `npm run build` on your system.
2. Inside your project, a `dist` folder will be created containing the static assets.
3. In the Cloudflare Dashboard, go to **Workers & Pages** > **Create** > **Upload assets**.
4. Drag and drop the `dist/` folder.
5. Once uploaded, go to the page's **Settings** > **Environment Variables** and add `VITE_API_BASE_URL` pointing to your backend URL.

---

## Step 2: Mapping your Custom Domain (e.g., `mechlog.com`)

1. In the Cloudflare Pages dashboard under your project, click the **Custom domains** tab.
2. Click **Set up a custom domain**.
3. Enter your domain name (e.g., `mechlog.com` or `app.mechlog.com`).
4. Cloudflare will automatically configure the necessary CNAME records in your DNS zone.

---

## Step 3: Authorizing Domains in Firebase Console

Since Google Sign-In is managed through Firebase Authentication, you **must** authorize your new domain in Firebase to allow login success.

1. Go to the **[Firebase Console](https://console.firebase.google.com/)**.
2. Open your project (e.g., `xanthic-device-c40ks`).
3. In the left sidebar, click **Build** > **Authentication**.
4. Click the **Settings** tab at the top.
5. In the left sub-menu, click **Authorized Domains**.
6. Click **Add domain** and enter your domains:
   - `mechlog.com`
   - Your Cloudflare subdomains (e.g., `your-app.pages.dev`)
7. Click **Save**.

---

## Technical Details Installed
* **CORS Support**: Added a lightweight, high-performance CORS middleware in `server.ts` to allow secure pre-flight `OPTIONS` requests and authorize client-side requests from Cloudflare Page domains.
* **Global Fetch Interceptor**: Added a dynamic wrapper around `window.fetch` inside `src/App.tsx` that automatically prefixes all API requests with `VITE_API_BASE_URL` when specified, ensuring a zero-configuration codebase that runs seamlessly in both monolithic and decoupled modes.
