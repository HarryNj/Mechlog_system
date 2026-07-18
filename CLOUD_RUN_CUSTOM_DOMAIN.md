# Custom Domain Mapping Guide for `mechlog.com` (Cloud Run Full-Stack)

Your application is a **full-stack Node.js + React app** (with backend API endpoints in `server.ts` and database connectors). It is running live in a high-performance **Google Cloud Run container** at your live URL:
`https://ais-pre-nirmkj3yoeyfseq4icue22-23626597169.europe-west2.run.app`

Because it is full-stack, deploying to static Firebase Hosting alone would cause your backend database APIs (`/api/*`) to fail. Instead, you should map your custom domain **`mechlog.com`** directly to your active **Cloud Run** container!

Since we do not have access to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) to configure DNS, you will need to complete these quick steps to make it live:

---

## Step 1: Add Custom Domain Mapping in Google Cloud Run

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your Google Cloud project (Project ID: **`xanthic-device-c40ks`**).
3. Search for and select **Cloud Run** in the top search bar.
4. Click on your active service container in the list.
5. At the top of the service details page, click on the **Manage Custom Domains** button (or click **Integration** -> **Add Custom Domain**).
6. Click **Add Mapping**:
   * **Service**: Select your active service.
   * **Domain**: Type `mechlog.com` (and optionally `www.mechlog.com`).
7. Click **Continue**. 

---

## Step 2: Verify Domain Ownership

Google Cloud will generate a verification **TXT Record** to ensure you own `mechlog.com`.

1. Copy the TXT Record value (it looks like `google-site-verification=xxxx`).
2. Log in to your domain registrar (e.g. GoDaddy, Namecheap, Cloudflare, etc.) where you purchased `mechlog.com`.
3. Go to the **DNS Settings** or **DNS Zone Editor** for `mechlog.com`.
4. Add a new DNS Record:
   * **Type**: `TXT`
   * **Name / Host / Alias**: `@` (or leave blank)
   * **Value / Text / Content**: Paste the verification string.
   * **TTL**: `3600` (or default)
5. Save the record, then click **Verify** in the Google Cloud Console.

---

## Step 3: Add A / AAAA / CNAME Records in your DNS Registrar

Once verified, Cloud Run will provide you with the exact IP addresses (A/AAAA records) or a CNAME record to point your domain to the server.

1. Go back to your domain registrar's DNS settings.
2. If Cloud Run provides **A Records** (IP addresses):
   * Create a new `A` record for **Host `@`** pointing to the first IP.
   * Create a new `A` record for **Host `@`** pointing to the second IP (if provided).
   * Create a `CNAME` record for **Host `www`** pointing to `mechlog.com` (or the given target).
3. Save all changes.

---

## Step 4: Live Verification

* Google Cloud will automatically request and install an **SSL Certificate (HTTPS)** for `mechlog.com`.
* Once DNS propagates (usually in 15–30 minutes, up to 24 hours globally) and SSL is active, your full-stack app will be live and secure at **`https://mechlog.com`**!
