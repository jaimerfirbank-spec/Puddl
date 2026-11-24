# Reliability checks

Run `node --test tests/reliability.test.cjs` from the repository root.

For the browser checks, install Playwright outside this app, start a local server
with `python3 -m http.server 7894 --bind 127.0.0.1`, then run
`PUDDLE_PLAYWRIGHT_PATH=/absolute/path/to/playwright node tests/browser-reliability.cjs`.
The browser check uses an isolated headless Chrome at the standard macOS app path,
blocks auth requests and never writes production map records.

The SQL migration is prepared only. Check it on a staging database with two
accounts and concurrent transactions before applying it to production.

## Ask Puddle answers

`tests/ask-golden.cjs` compares every Ask question's answer, meaning and highlight, on the three demo maps, with a stored record (`tests/fixtures/ask-golden.json`). See the top of the file for how to run it. Run it after any change to the Ask question list. Existing answers must not change; new questions are allowed, then add them with `--write`.
