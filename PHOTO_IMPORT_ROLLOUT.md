# Photo import rollout

These changes are prepared on `codex/photo-import-reliability`, based on the existing image-to-map prototype and including the app reliability fixes.

Before deploying this branch:

1. On a staging Supabase project, apply `20261117_reliable_map_limits.sql`, then `20261117_photo_read_allowance.sql`. The existing teams/maps schema must already be installed. Verify ownership protection with two users and concurrent admissions/map inserts. Both migrations have now passed the staging database checks described below; production has not been changed.
2. Set Vercel server environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the same Supabase project used by the app; keep `OPENAI_API_KEY` server-side. Never put a service-role key in the client or use it for the allowance RPC.
3. Check the Vercel function duration setting supports the expected read time. The upstream request times out after 90 seconds; the hosting limit may be shorter.
4. Deploy an approved preview and sign in there. The photo page uses the sign-in session for that origin; a session on the production hostname does not automatically sign you in on a preview hostname.
5. Check one real photo and the account/usage errors. Compare node names, connections and arrowheads with the drawing. Run this before deploying production.

The database grants ten photo reads per active team member in a rolling hour. The limit is shared between function instances. Failed provider reads still consume an allowance, to bound cost. The RPC denies accounts without an active team subscription. Until configuration and migrations are ready, the API fails closed instead of making an unprotected paid call.

The prototype continues to simplify ovals to circles and node sizes to Puddle's standard sizes. Connection strengths start at moderate. Its review screen says so; inference of relationship strength is not implemented.

Tests: `node --test tests/*.test.cjs`; browser steps are documented in `tests/README.md`. The browser photo test mocks authentication and provider responses. No accuracy claim is made for the larger drawing that has not yet been supplied.

## Staging integration checks, 17 November 2026

A separate free Supabase project, **Puddle Staging**, was created in PuddL and initialized without copying production records. Both migrations applied successfully. Synthetic staging accounts passed real sign-in, private-map isolation, ownership protection, stale-save rejection, concurrent map/seat limits, and concurrent photo allowance checks. A local browser connected to that actual staging database passed save/edit/undo/reload/reopen and cleaned up its disposable map.

The browser now loads public database settings from `/api/client-config`, so a branch preview can use the same staging database as its photo endpoint. The endpoint rejects private/service-role keys and never exposes the OpenAI key. Unconfigured preview hosts cannot silently fall back to production. Vercel preview database variables are scoped to `codex/photo-import-reliability`; production settings are unchanged.

Credential fixtures live outside the repository and are not committed. `tests/staging-integration.cjs` and `tests/browser-staging.cjs` require an explicit non-production project reference and an external fixture file. `tests/staging-preview-server.cjs` serves a loopback-only preview with public staging configuration.

The hosted Vercel preview completed one real OpenAI image read using a generated test drawing: School → Parents → Library. All three labels and both arrow directions were correct, and the imported 3-node/2-connection map was verified in the staging database. This is an integration check, not an accuracy benchmark for photographed handwriting.

That live run exposed an initialization race: the bridge could consume the import before team lookup finished, causing the saved-maps panel to open over the canvas. Import now waits for explicit account/team readiness, and afterSignIn captures the pending-import intent before asynchronous initialization. A real-staging browser regression verifies that the import saves separately and the maps panel remains closed.
