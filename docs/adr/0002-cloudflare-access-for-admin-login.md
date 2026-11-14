# Admin login via Cloudflare Access, not in-app auth

Admins sign in by email through Cloudflare Access, which sits in front of `/admin` with an email allowlist and one-time codes. The app itself has no login code, no user table and no sessions; it trusts the identity header that Access adds. Building login links into the app would have meant an email-sending integration, an Admin table and session handling, all for a small organizing team. Adding or removing an Admin is done in the Cloudflare dashboard, not in the app.
