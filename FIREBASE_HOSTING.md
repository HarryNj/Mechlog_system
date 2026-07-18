# Firebase Hosting & Custom Domain Deployment Guide (`mechlog.com`)

This guide explains how to deploy your full-stack React application to **Firebase Hosting** and connect your custom domain **`mechlog.com`** so that your live app is accessible there instead of the development URL.

---

## Prerequisites

1. Your Firebase Project ID is **`xanthic-device-c40ks`** (already provisioned and initialized).
2. You own the domain name **`mechlog.com`** and have access to its DNS management console (e.g., GoDaddy, Namecheap, Cloudflare, Tencent Cloud DNS, etc.).

---

## Step 1: Deploy to Firebase Hosting

To publish your built static files to Firebase:

1. **Install the Firebase CLI** on your local computer or terminal:
   ```bash
   npm install -g firebase-tools
   ```

2. **Log in to Google / Firebase**:
   ```bash
   firebase login
   ```

3. **Verify the Configuration**:
   We have already created the `firebase.json` file in your root folder:
   ```json
   {
     "firestore": {
       "rules": "firestore.rules"
     },
     "hosting": {
       "public": "dist",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

4. **Build and Deploy**:
   Build the applet production code, then run the deploy command:
   ```bash
   npm run build
   firebase deploy --only hosting --project xanthic-device-c40ks
   ```

   Once finished, Firebase will provide you with a default URL like `https://xanthic-device-c40ks.web.app` or `https://xanthic-device-c40ks.firebaseapp.com`.

---

## Step 2: Connect `mechlog.com` in the Firebase Console

To map your custom domain:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **xanthic-device-c40ks**.
3. In the left navigation sidebar, click on **Build** -> **Hosting**.
4. Scroll down to the **Domains** section and click the **Add Custom Domain** button.
5. In the input box, type: `mechlog.com` (and check "Redirect www.mechlog.com to mechlog.com" if desired).
6. Click **Continue**.

---

## Step 3: Verify Domain Ownership (DNS Settings)

Firebase needs to prove that you own `mechlog.com` before issuing an SSL certificate.

1. Firebase will show you a **TXT record** (usually with host `@` or blank, and a value like `firebase-hosting-verification=xxxx`).
2. Log in to the registrar where you registered `mechlog.com` (e.g. GoDaddy, Cloudflare, Tencent Cloud, Hostinger).
3. Navigate to the **DNS Zone Editor / DNS Settings** for `mechlog.com`.
4. Create a new DNS record with these values:
   * **Type**: `TXT`
   * **Name / Host**: `@` (or leave empty)
   * **Value / Content**: Paste the verification string copied from the Firebase Console.
   * **TTL**: `3600` (or default)
5. Click Save. It may take 5–15 minutes for the DNS settings to propagate.
6. Click **Verify** in the Firebase Console.

---

## Step 4: Add A Records to Point to Firebase

Once verified, Firebase Hosting will provide you with **one or two A Records** with IP addresses (for example: `199.36.158.100`).

1. Go back to your DNS Zone Editor for `mechlog.com`.
2. Delete any existing `A` records pointing to other servers (if you had them set up).
3. Create new records pointing to the Firebase IP addresses:
   * **Record 1**:
     * **Type**: `A`
     * **Name / Host**: `@` (or leave empty)
     * **IPv4 Address / Value**: Paste the 1st IP provided by Firebase.
   * **Record 2**:
     * **Type**: `A`
     * **Name / Host**: `@` (or leave empty)
     * **IPv4 Address / Value**: Paste the 2nd IP provided by Firebase (if provided).
4. Save the records.

---

## Step 5: Wait for SSL Provisioning

* **DNS Propagation**: It can take up to 24 hours for DNS updates to propagate worldwide, though usually it happens in less than an hour.
* **SSL Certificate**: Firebase automatically provisions an SSL (HTTPS) certificate for `mechlog.com`. This process begins as soon as the A records are detected and usually takes **1 to 2 hours**.
* Once the status changes to **Active** in your Firebase Hosting console, you can securely access your app at **`https://mechlog.com`**.
