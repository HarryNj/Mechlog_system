# Fixing Google OAuth 403 Error

The 403 error you're seeing is from Google's OAuth consent screen. It happens when your Google Cloud Project's OAuth Consent Screen is in "Testing" mode and you're trying to log in with an email that isn't in the Test Users list.

### How to fix it:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select the project you created for your Google OAuth.
3. Go to **APIs & Services** > **OAuth consent screen**.
4. If the Publishing Status is **Testing**:
   - Scroll down to **Test users**.
   - Click **+ ADD USERS**.
   - Type in the email address you are trying to log in with.
   - Click **Save**.
5. Alternatively, click **PUBLISH APP** to make it available to any Google account (requires no verification if you only use email/profile scopes).
