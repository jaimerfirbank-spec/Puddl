# Puddle Lens

Phone companion at `/lens/`; desktop inbox at `/lens/inbox.html`. Uses the existing Supabase email/password account and session on the same origin. Users sign in on both devices; this first version does not implement QR pairing or native app-store distribution.

Phone: camera/gallery → full-photo preview → rotate/name → private upload → confirmation. Desktop: inbox (polls every 15 seconds while visible) → existing photo review → explicit AI read → corrected graph → separate new map. Uploading alone never triggers an AI request. No early image-quality rejection was added.

Lens matches Puddle's DM Sans, neutral surfaces, dark actions and simple borders. It has a manifest, raster home-screen icons and install instructions. There is no offline upload queue or service worker; the user must keep it open until sending finishes. Actual iPhone/Android camera, HEIC conversion and home-screen installation still require physical-device checks. Browsers that cannot decode a chosen image request JPG/PNG/WebP instead.

## Storage and rollout

Apply `supabase/migrations/20261117184109_puddle_lens_photos.sql` after the team schema. `puddle-lens` is a private bucket, with owner-only listing/download/removal and active-team membership required for upload. JPEG only; 2.9 MB per object. Phone preparation uses the existing 2000px longest-side and JPEG .86 setting; this remains a limitation for dense A1 drawings. Filenames contain a random ID and base64url title, never credentials. Downloads derive the owner from the current session, never URL parameters. No overwrite permission is granted. A retry uses the same object key to avoid duplicate uploads after a lost response.

Photos remain in the uploader's inbox until they remove them, including after creating a map. No automatic retention job, total account storage quota or resumable/background upload is implemented in this first version. Restrict the first rollout to the agreed customer trial and monitor storage before broad availability.

Only the isolated free staging project was changed. Preview environment must use staging `SUPABASE_URL` and `SUPABASE_ANON_KEY`; keep `OPENAI_API_KEY` server-side. Production schema and deployments have not been changed.

## Verification

`node --test tests/*.test.cjs`: existing map/API regressions plus filename safety, title preservation, account-derived download paths and signed-out denial.

`tests/lens-staging.cjs`, with explicit non-production fixture/ref: real upload/download byte equality, other-account read/list/upload denial, public download denial, overwrite denial, MIME and file-size limits; synthetic API test object removed.

Browser at 390×844: real staging sign-in, gallery selection of the existing 30-node photo, rotation (2000×1362 after turning), rename and successful upload. Desktop inbox received that photo; opening Review loaded it into the existing reader without an AI call. No physical phone camera or paid recognition run is claimed for this check.

Supabase security advisors were reviewed. No Lens-specific findings; existing schema advisories include `touch_updated_at` search path and callable helper/trigger functions, plus leaked-password protection disabled. The denied direct access to `photo_read_requests` is intentional (RPC only). These existing items were not changed as part of Lens. References: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable and https://supabase.com/docs/guides/auth/password-security.
