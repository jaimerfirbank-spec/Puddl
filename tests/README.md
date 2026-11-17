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
