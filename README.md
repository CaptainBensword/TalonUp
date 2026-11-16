# TalonUp

TalonUp is a video-sharing platform built by Talon. Anyone can browse approved videos without an account. An account is only needed to upload or report a video; there is no separate channel setup.

## In the repository

- `index.html` — page structure
- `styles.css` and `talonup-theme.css` — layout and visual theme
- `app.js` and `interactions.js` — feed, search, accounts and upload behavior
- `assets/` — TalonUp homepage artwork and emblem
- `config.js` — public Supabase project settings
- `supabase/setup.sql` — database, security policies and storage bucket

## Connect Supabase (one-time setup)

The site code is in place. A Supabase project is required to provide the shared database, login and video storage. The project must be created in the owner's Supabase account; this repository cannot create that account or project.

1. Create a project at [supabase.com](https://supabase.com/).
2. In the project's SQL Editor, open a new query, paste the contents of [supabase/setup.sql](supabase/setup.sql), and run it.
3. Open Project Settings → API. Copy the **Project URL** and the **publishable key** (or legacy anon key).
4. Open [config.js](config.js) and replace the two empty strings:

   ```js
   window.TALONUP_CONFIG = {
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "YOUR-PUBLISHABLE-KEY",
     MAX_UPLOAD_MB: 50
   };
   ```

   The URL and publishable/anon key are designed to be used in browser apps. **Never add a service-role key, database password, or other secret to this public repository.**

5. In Supabase Authentication → URL Configuration, set the Site URL to the live GitHub Pages address and add that same address to the Redirect URLs. For this repository it is:
   `https://captainbensword.github.io/TalonUp/`
6. Keep email confirmation enabled. A new user may need to confirm their email before signing in.

## Review access

New videos start as `pending` and are not shown in the public feed until approved.

After creating your own TalonUp account, open the Supabase SQL Editor and run the following statement, replacing the email with the address used for your account:

```sql
insert into public.talonup_admins (user_id)
select id from auth.users where email = 'YOUR-ACCOUNT-EMAIL'
on conflict (user_id) do nothing;
```

The review queue will then appear for that account. Review access is stored in Supabase, not in frontend code.

## Publishing

GitHub Pages should use branch `main` and folder `/ (root)` under Repository Settings → Pages. No build step or local installation is required.

## Uploads

- The default bucket limit is 50 MB, matching Supabase Free's maximum per-file setting.
- Videos larger than 6 MB use resumable TUS uploads with progress and retry support.
- The `media` bucket is public so approved videos can play without an account.
- Upload paths are private to the uploader for writes. New database rows remain pending until reviewed.
- Users may upload a video thumbnail, but the feed never uses the homepage artwork as a video thumbnail.

Supabase references: [file size limits](https://supabase.com/docs/guides/storage/uploads/file-limits) · [resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)

## Current scope

The first version includes browsing, search across the loaded feed, category filters, newest/oldest sorting, email/password accounts, video uploads, optional thumbnails, review, and reports.

Comments, subscriptions, playlists, recommendations, transcoding, creator analytics and mobile apps are not included yet.
