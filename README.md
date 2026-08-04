# Deployment to Render

This application is ready to be deployed to Render.

## How to deploy:
1. Push your code to a GitHub repository.
2. Go to [Render](https://render.com/) and create an account if you don't have one.
3. Click on **New** -> **Blueprint**.
4. Connect your GitHub repository.
5. Render will detect the `render.yaml` file and automatically configure your Web Service.
6. Once the service is created, go to the **Environment** tab in your Render Dashboard and add your environment variables (e.g., `DATABASE_URL`, `VITE_SUPABASE_URL`, etc.).
7. Click **Manual Deploy** -> **Deploy latest commit**.

Your app should now be live!
