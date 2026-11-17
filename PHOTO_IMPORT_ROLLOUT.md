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

Tests: `node --test tests/*.test.cjs`; browser steps are documented in `tests/README.md`. The browser photo test mocks authentication and provider responses. Accuracy observations distinguish synthetic integration checks from the user-reported hand-drawn-map tests below.

## Staging integration checks, 17 November 2026

A separate free Supabase project, **Puddle Staging**, was created in PuddL and initialized without copying production records. Both migrations applied successfully. Synthetic staging accounts passed real sign-in, private-map isolation, ownership protection, stale-save rejection, concurrent map/seat limits, and concurrent photo allowance checks. A local browser connected to that actual staging database passed save/edit/undo/reload/reopen and cleaned up its disposable map.

The browser now loads public database settings from `/api/client-config`, so a branch preview can use the same staging database as its photo endpoint. The endpoint rejects private/service-role keys and never exposes the OpenAI key. Unconfigured preview hosts cannot silently fall back to production. Vercel preview database variables are scoped to `codex/photo-import-reliability`; production settings are unchanged.

Credential fixtures live outside the repository and are not committed. `tests/staging-integration.cjs` and `tests/browser-staging.cjs` require an explicit non-production project reference and an external fixture file. `tests/staging-preview-server.cjs` serves a loopback-only preview with public staging configuration.

The hosted Vercel preview completed one real OpenAI image read using a generated test drawing: School → Parents → Library. All three labels and both arrow directions were correct, and the imported 3-node/2-connection map was verified in the staging database. This is an integration check, not an accuracy benchmark for photographed handwriting.

That live run exposed an initialization race: the bridge could consume the import before team lookup finished, causing the saved-maps panel to open over the canvas. Import now waits for explicit account/team readiness, and afterSignIn captures the pending-import intent before asynchronous initialization. A real-staging browser regression verifies that the import saves separately and the maps panel remains closed.

## Handwriting guidance

The user reported correct recognition on a 15-node drawing and on a 30-node/30-connection drawing. A further angled, shadowed photo retained the map structure but flagged an uncertain curly L and read a name beginning with C. These are user-reported results, not an independently captured benchmark.

The upload screen now links to `hand-drawn-map-guide.html`, a printable guide with drawn examples for L/C, I/J, U/V and O/0, plus LOUIS written with an angular L. It recommends separated capitals, clear spacing and arrowheads while preserving actual spelling, accents and punctuation. It explains that naturally curved letters retain their curves and that every reading should be reviewed.

## Thirty-node import and scale checks

The actual reviewed 30-node/30-connection result was imported through the hosted preview, saved to staging, reloaded and reopened. Comparing the stored graph with the review table confirmed every label, endpoint and arrow direction was retained, including SALLY remaining isolated. Unknown shapes continue to use the prototype's documented circle fallback.

This check exposed node overlap: photo positions were fitted to the viewport without reserving room for the fixed-size Puddle nodes. Import now scales all positions uniformly to provide room for node shapes and labels, preserving the drawing's relative layout and aspect ratio. Pairwise spacing checks run in memory; the existing 500-node API bound remains unchanged.

The revised bridge passed real-staging import/save/reload/reopen checks with the actual 30-node graph and a generated 150-node/150-connection payload. These are import/storage checks, not evidence that 150 nodes can yet be recognised from one photograph. The current photo preprocessing still downsizes the longest edge to 2000 pixels; a dense A1 photo will need a separate readability test.
