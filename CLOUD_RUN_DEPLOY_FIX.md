# Google Cloud Run Deployment & Fix Guide

## Resolving: `spec.template.metadata.annotations[run.googleapis.com/sources]: Source annotation has sources that are not referenced by a container`

This error occurs when you run `gcloud run services update` or `gcloud run deploy` on a Cloud Run service that was previously deployed with source tracking, and the new revision command doesn't match the original source metadata.

---

### Method 1: Deploy with `--clear-base-image-annotations` (Fastest)

Run this command in your terminal where `gcloud` is installed:

```bash
gcloud run deploy YOUR_SERVICE_NAME \
  --source . \
  --region europe-west2 \
  --clear-base-image-annotations \
  --allow-unauthenticated
```

*(Replace `YOUR_SERVICE_NAME` with your Cloud Run service name, e.g. `mechanicsparelog` or similar)*

---

### Method 2: Strip Conflicting Annotations with `gcloud run services update`

If you are updating environment variables, CPU/memory, or service settings:

```bash
gcloud run services update YOUR_SERVICE_NAME \
  --region europe-west2 \
  --remove-annotations="run.googleapis.com/sources,run.googleapis.com/source-images"
```

---

### Method 3: Deploying via Container Image (Cloud Build / Artifact Registry)

If you are building a Docker image using the included `Dockerfile`:

1. **Submit the build to Cloud Build:**
   ```bash
   gcloud builds submit --tag gcr.io/xanthic-device-c40ks/mechanicsparelog:latest
   ```

2. **Deploy the image directly:**
   ```bash
   gcloud run deploy YOUR_SERVICE_NAME \
     --image gcr.io/xanthic-device-c40ks/mechanicsparelog:latest \
     --region europe-west2 \
     --remove-annotations="run.googleapis.com/sources,run.googleapis.com/source-images" \
     --allow-unauthenticated
   ```

---

### Method 4: Fix via Google Cloud Console (UI)

1. Open **[Google Cloud Run Console](https://console.cloud.google.com/run)**.
2. Select your project (`xanthic-device-c40ks`).
3. Click on your service name.
4. Click **Edit & Deploy New Revision** at the top.
5. In the top right, switch to the **YAML** tab.
6. Under `spec:` -> `template:` -> `metadata:` -> `annotations:`, find and delete the line for:
   `run.googleapis.com/sources: ...`
   and (if present) `run.googleapis.com/source-images: ...`
7. Click **Deploy**.
