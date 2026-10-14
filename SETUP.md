# Habit & Life Tracker: setup

Takes about 20 minutes, once. Do it on your laptop.
Your Supabase database and server function are already set up.

## Part 1: Put the app online (GitHub Pages)

1. Create a free account at github.com and a new **public** repository, for example `life-tracker`.
2. Click **Add file > Upload files** and upload everything in this folder (including the `icons` folder).
3. Open **Settings > Pages**, set **Source** to "Deploy from a branch", choose `main` and `/ (root)`, and save.
4. After about a minute the app is live at `https://YOUR-NAME.github.io/life-tracker/`. This is "your app link" below.

## Part 2: Let sign-up emails point to your app (Supabase)

1. Open supabase.com/dashboard and select the project **Habbit and Life tracker**.
2. Go to **Authentication > URL Configuration**.
3. Set **Site URL** to your app link, and add the same link under **Redirect URLs**.

Now open your app, go to **Settings > Sync > Create account**, confirm the email, and sign in.
Sign in with the same account on every device. Your existing data on that device is uploaded on the first sign-in.

## Part 3: Google Calendar and Gmail (optional)

1. Go to console.cloud.google.com and create a new project, for example "Life Tracker".
2. Open **APIs & Services > Library** and turn on **Google Calendar API** and **Gmail API**.
3. Open **Google Auth Platform** (also called "OAuth consent screen"):
   - **Branding:** app name "Life Tracker", your email as support and contact email.
   - **Audience:** choose **External** and leave it in **Testing**. Under **Test users**, add every Google account you want to connect.
   - **Data access:** add these two scopes:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/gmail.labels`
4. Open **Clients > Create client**, choose **Web application**, and under **Authorized JavaScript origins** add `https://YOUR-NAME.github.io` (just the domain, no path). Create it and copy the **Client ID** and **Client secret**.
5. In Supabase, go to **Edge Functions > Secrets** and add:
   - `GOOGLE_CLIENT_ID` = your Client ID
   - `GOOGLE_CLIENT_SECRET` = your Client secret
6. In this folder, open `config.js`, paste the Client ID between the quotes of `GOOGLE_CLIENT_ID`, and upload `config.js` to GitHub again.

Then in the app: **Settings > Connect a Google account**. Repeat for each account.

**Good to know:** Because the Google app stays in "Testing", Google ends its access after 7 days. The app then shows **Reconnect** next to that account. One tap fixes it, and it applies to all your devices.

## Install the app

- **Laptop (Chrome or Edge):** click the install icon in the address bar.
- **Android (Chrome):** menu > **Install app**.
- **iPhone (Safari):** **Share > Add to Home Screen**.

## Updating later

Upload the new files to the same repository. The app picks up the new version the next time it opens while online.
