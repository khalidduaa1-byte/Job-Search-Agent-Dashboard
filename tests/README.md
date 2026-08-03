# The checks

`check.mjs` is 79 assertions driving a real browser against the dashboard. There is no test
framework here and there is not going to be one: the app has no dependencies and no build step, and
adding a runner to test three hand-written files would cost more than it returns.

## Running it

Playwright is installed **ad hoc** and is deliberately **not** a dependency of this repo. It is
gitignored for that reason.

```
npm install playwright                 # ad hoc, do not commit the lockfile
python3 -m http.server 8000 &          # the app has to be served over http
node tests/check.mjs
```

If Playwright's bundled Chromium is missing or its build number does not match the package, point
the script at a browser that already exists rather than downloading a second one:

```
CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tests/check.mjs
```

`BASE` overrides the URL, default `http://127.0.0.1:8000`. The script exits non-zero on the first
failure and prints every assertion as `ok` or `FAIL`.

## What it actually protects

Five of these are the rules `CLAUDE.md` calls non-negotiable, and they are the ones a later feature
is most likely to undo by accident:

1. **An import cannot overwrite triage.** Set a status and notes by hand, then re-import a digest
   that carries different values for `status`, `hidden` and `notes`. All three survive; `score`
   refreshes. This is the most important assertion in the repo.
2. **An applied role does not come back.** Mark a role applied, re-import the whole digest, and the
   daily list is unchanged. Then click the pipeline row and confirm it is recoverable, because it is
   a filter and not a delete.
3. **The dedup key ignores the tracking query string.** `data/sample-digest.json` carries
   `?utm_source=digest` on a posting already on the board, so re-importing must not duplicate it.
4. **Malformed rows are rejected by row number** while the good row in the same payload still lands,
   and the coercions (unknown `remote`, a `band` that disagrees with `score`, a non-http `url`) are
   reported as warnings rather than silently applied.
5. **No horizontal overflow at 390px.** Measured in an **iframe**, because headless Chrome clamps
   its window to about 500px and `--window-size=390` crops rather than reflowing, which looks
   exactly like the bug you are testing for.

Plus the apply-link behaviour, export, `javascript:` URLs never reaching an `href`, and the
structural accessibility bits: pipeline rows are real buttons with `aria-pressed`, every control has
an accessible name, one `h1`.

## The one check no grep could replace

```
ok    role title sits below the employer label
```

`.row-co` and `.row-title` were once inline spans, and rendered as
`LUMINA SYSTEMSAI Deployment Manager`. The CSS was valid, the HTML was valid, and nothing in the
markup said it was wrong. The assertion compares the two bounding boxes, which is the only way to
catch it. If you are tempted to delete a geometry assertion because it looks fussy, this is the one
to keep.

## When a check fails after you change the sample data

Several assertions hardcode counts from `data/sample-opportunities.json`: ten rows, eight not
hidden, four at 90 plus, five to action and three in the pipeline. `data/sample-digest.json` has
three rows, one of which (`Meridian Field`) is **not** on the sample board, so a full digest import
is `1 added, 2 updated` rather than `0 added`. That asymmetry is deliberate, since it is what proves
dedup is matching keys rather than refusing everything. Change either file and these counts have to
move with it.
