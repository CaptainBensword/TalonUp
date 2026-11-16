# TalonUp

**TalonUp is a video-sharing platform built by Talon.** Browse without an account, search the feed, and create an account only when you're ready to upload.

This first version is a lightweight static site with Supabase handling accounts, the database, and video storage. It does not need a build step or a local development environment.

## What's here

- Public video feed — watching does not require an account
- Search across video titles, descriptions, categories, and creator names
- Category filters and newest/oldest sorting
- Email and password accounts
- Upload form with title, description, category, and optional thumbnail
- Resumable video uploads with a visible progress bar
- Optional creator profile created automatically with the account — no separate channel setup
- Upload review queue so new videos are not published automatically
- Report button on approved videos
- Responsive layout for desktop, tablet, and mobile

## Connect the backend

The website files are ready, but accounts and shared uploads need a Supabase project. These are setup steps, not code-writing steps.

1. Create a project at [Supabase](https://supabase.com/).
2. Open the project's **SQL Editor**, create a new query, paste the full contents of [supabase/setup.sql](supabase/setup.sql), and run it.
3. In Supabase, open **Project Settings → API**. Copy the Project URL and the **publishable key** (or legacy anon key).
4. Open [config.js](config.js) in this repository and add those two values:

   ```js
   window.TALONUP_CONFIG = {
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "YOUR-PUBLISHABLE-KEY",
     MAX_UPLOAD_MB: 50
   };
   ```

   The URL and publishable/anon key are intended for browser apps. **Never put a service-role key or database password in this repository.** Row Level Security is enabled by the setup SQL.

5. In Supabase **Authentication → URL Configuration**, set the Site URL to your live TalonUp address and add that address to the Redirect URLs. For GitHub Pages, it will look like:

   `https://CAPTAINBENSWORD.github.io/TalonUp/`

   Keep email confirmation enabled. Users may need to confirm their email before signing in.

6. After creating your own TalonUp account, make that account a reviewer by running this in the Supabase SQL Editor (replace the email):

   ```sql
   insert into public.talonup_admins (user_id)
   select id from auth.users where email = 'YOUR-ACCOUNT-EMAIL'
   on conflict (user_id) do nothing;
   ```

   Refresh TalonUp. The review queue will appear for that account. Only admins can approve or reject videos.

## Publish the site with GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`, then save.
4. Wait for GitHub Pages to publish, then use the generated site address in the Supabase Auth URL settings above.

The site is plain HTML, CSS, and JavaScript. No npm install, build command, or framework setup is required.

## Upload notes

- The included storage setup caps files at **50 MB**, matching the maximum file-size setting available on Supabase Free projects at the time this version was built. Larger files need an eligible paid Supabase plan and a higher configured limit.
- Uploads over 6 MB use TUS resumable transfers. This adds progress feedback and allows interrupted uploads to be resumed by the browser.
- Videos are stored in the `media` bucket. The public feed only lists videos with `status = 'approved'`.
- Every new upload starts as `pending`. Review it before it appears publicly.
- The media bucket is public so approved videos can play without viewers signing in. Upload paths are generated randomly and are not shown in the public feed until approval.

## Current preview boundaries

This is the first working slice, not a full-scale YouTube replacement. It currently has feed browsing, search, categories, accounts, uploads, review, and reports. Comments, subscriptions, playlists, creator analytics, recommendations, transcoding, and mobile apps are not included yet.

## Safety and ownership

Only upload videos you made or have permission to share. Keep personal information out of public videos. New uploads are held for review, and signed-in viewers can report a video for review. Admin access is assigned in Supabase itself, never in frontend code.

---

**TalonUp — Watch something good.**
