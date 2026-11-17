# Reliability checks

Run `node --test tests/*.test.cjs` from the repository root.

For the browser checks, install Playwright outside this app, start a local server
with `python3 -m http.server 7894 --bind 127.0.0.1`, then run
`PUDDLE_PLAYWRIGHT_PATH=/absolute/path/to/playwright node tests/browser-reliability.cjs`.
The browser check uses an isolated headless Chrome at the standard macOS app path,
blocks auth requests and never writes production map records.

The SQL migration is prepared only. Check it on a staging database with two
accounts and concurrent transactions before applying it to production.

Run `tests/browser-photo.cjs` with the same Playwright environment to exercise the photo flow. All photo API and auth responses in that check are mocked.

Real staging checks use `tests/staging-integration.cjs` and `tests/browser-staging.cjs`, with `PUDDLE_STAGING_REF` explicitly set to a non-production project. Put synthetic credentials in an external fixture selected with `PUDDLE_STAGING_AUTH`; never commit that file. The loopback staging server is `tests/staging-preview-server.cjs`. These tests create and remove only synthetic staging records.
