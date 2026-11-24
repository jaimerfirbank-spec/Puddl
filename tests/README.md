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

`tests/ask-phrases.cjs` measures how well typed wording reaches the right question, using the 207 phrasings in `tests/fixtures/ask-phrases.json`. It fails if a phrasing is answered with the wrong question. Read the numbers with care: the later phrasings were added after they failed once, so the rates on this set are higher than on wording nobody has seen. On 42 phrasings written fresh and measured before any tuning, about a third were answered directly and about three quarters had the right question offered.

## Running everything

GitHub runs all of these on every pull request and on `main` (`.github/workflows/tests.yml`): the saving and imported-data checks, a check that `viewer.html` is up to date, the Ask golden record, Ask matching, and ten browser checks of the 24 November features (`node tests/run-browser.cjs`, each in a fresh page). To run them locally you need Playwright (`npm install --no-save playwright`). Without internet, point `PUDDLE_D3_PATH` at a local `d3.min.js`.
