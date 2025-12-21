# Fixing Google "Access Blocked: Authorization Error" (Error 400: origin_mismatch)

You are seeing this error because Google's security servers do not recognize `http://localhost:5173` as a trusted website for your specific Client ID.

To fix this, you must "whitelist" this URL in your Google Cloud dashboard.

## Step-by-Step Fix

1.  **Open Google Cloud Console**: Go to [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2.  **Find Your Project**: Ensure you have selected the project where you created the Client ID.
3.  **Click Your Client ID**: Under "OAuth 2.0 Client IDs", click on the name of your specific ID (`716053866816-scs...`).
4.  **Add URI**:
    *   Scroll down to the section **"Authorized JavaScript origins"**.
    *   Click **ADD URI**.
    *   Type exactly: `http://localhost:5173`
    *   *(Optional)* It is good practice to also add `http://127.0.0.1:5173`.
5.  **Save**: Click the blue **SAVE** button at the bottom.
6.  **Wait**: It can take **5 minutes** to a few hours for Google to update. usually it works in 5 mins.
7.  **Retry**: Refresh your app and try logging in again.

## Temporary Workaround
I have added a **"Developer Mode"** button to the login screen. You can click this to bypass the Google Login and enter the app immediately while you wait for the Google settings to update.
