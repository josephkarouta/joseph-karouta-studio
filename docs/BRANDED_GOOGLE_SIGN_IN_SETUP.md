# Heyy Studio branded Google sign-in

Target Supabase custom domain: `auth.heyystudio.com`

This removes the random Supabase project hostname from Google's consent screen. It requires a paid Supabase project and the Custom Domains add-on. The website code already reads `NEXT_PUBLIC_SUPABASE_URL`, so no authentication component rewrite is required.

## 1. Supabase custom domain

In Supabase Dashboard open **Project Settings → General → Custom Domains**, purchase/enable the add-on, and enter:

`auth.heyystudio.com`

Supabase will provide the exact DNS verification records. Add those records at the DNS provider for `heyystudio.com`. Supabase custom domains use a CNAME plus the verification record shown by the dashboard. Do not invent the verification value.

Wait until Supabase reports the domain as verified. Do not activate it before completing the Google callback step below.

## 2. Google Auth Platform

In the Google Cloud project used by Supabase Google login, open **Google Auth Platform → Clients → Heyy Studio Web client**.

Keep the existing Supabase callback temporarily and add:

`https://auth.heyystudio.com/auth/v1/callback`

Under **Authorized JavaScript origins**, keep/add:

- `https://heyystudio.com`
- the actual production frontend origin if it uses `www`
- `http://localhost:3000` for local development only

In **Branding**, confirm the application name is **Heyy Studio**, add the official logo, set the support email, and add `heyystudio.com` as an authorised domain. Submit Google brand verification when appropriate.

## 3. Supabase Auth URL configuration

In **Authentication → URL Configuration**:

- Site URL: `https://heyystudio.com`
- Production redirect: `https://heyystudio.com/auth/callback`
- Local redirect: `http://localhost:3000/auth/callback`
- Netlify previews only when needed

Use exact production redirect paths rather than a broad wildcard.

## 4. Activate the custom domain

Return to Supabase Custom Domains and activate `auth.heyystudio.com` after Google accepts the new callback URI.

Supabase Auth will then advertise the branded callback domain during OAuth.

## 5. Environment variables

Update local and Netlify production environments:

```env
NEXT_PUBLIC_SUPABASE_URL=https://auth.heyystudio.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=KEEP_THE_EXISTING_ANON_OR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://heyystudio.com
```

The service-role key does not change. Never put it in a public environment variable.

Restart local development and trigger a new Netlify deployment after changing environment variables.

## 6. Test before removing the old callback

Test all of these:

1. Normal Google user login.
2. Admin Google login.
3. Logout and login again.
4. Localhost callback.
5. Production callback.
6. Incognito login with a new user.
7. Password login and reset links.

During the transition, keep both callback URIs in Google:

- `https://pbwufoambbzbakwhygmd.supabase.co/auth/v1/callback`
- `https://auth.heyystudio.com/auth/v1/callback`

Remove the old Supabase callback only after the branded flow works reliably in production.
