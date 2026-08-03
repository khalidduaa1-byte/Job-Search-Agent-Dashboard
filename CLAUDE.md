# Job Search Agent & Dashboard

Duaa Khalid's job search. A scheduled Claude task finds US roles on weekday mornings, scores
them against a written rubric, tailors a resume for the best one and emails the lot. This repo
holds the board they get triaged on, plus the prompts and the data contract that make the two
halves fit.

## Architecture

Three hand-written files for the app, sharing one stylesheet and one script. **No build step, no
framework, no dependencies.** Edit a file, push, it deploys.

| File | Role |
| --- | --- |
| `index.html` | The board: top bar, report header, four derived stat tiles, results list, right rail, import dialog |
| `styles.css` | Every rule. All design values are in the single `:root` block at the top |
| `app.js` | All behaviour, as small guarded IIFEs that return early if their root element is missing |
| `CONTRACT.md` | **The agent-to-dashboard contract.** Field ownership and the merge policy. Read before touching import |
| `schema/opportunity.schema.json` | The machine-readable shape. The agent's obligation, not the validator's |
| `prompts/profile.md` | **The verified profile. The only source for factual claims about her** |
| `prompts/scoring-rubric.md` | What a score means, including the hard caps |
| `prompts/daily-search.md` | The Monday to Thursday scheduled task |
| `prompts/weekly-roundup.md` | The Friday roundup. Emits no JSON, deliberately |
| `prompts/resume-tailor.md` | Tailoring as a diff against the master resume |
| `ingest/fetch_jobs.py` | Optional sourcing. Stdlib only, one function per source in `ADAPTERS` |
| `ingest/rubric.json` | Weights for the deterministic keyword prescore |
| `ingest/sources.json` | The employer watchlist. Tokens are **unverified**, see `SOURCES.md` |
| `resume/master-resume.md` | **The master resume**, the AI PM and GTM variant. The tailoring input |
| `resume/Duaa-Khalid-resume-CSM.pdf` | The CSM variant as exported. Layout reference only, never tailor from it |
| `resume/README.md` | Why the markdown is the master, plus the open resume issues checklist |
| `tests/check.mjs` | 79 browser assertions. Playwright, ad hoc, **not** a repo dependency |
| `SOURCES.md` | Where jobs come from, and why LinkedIn, Indeed, Apify and Composio are not adapters |
| `data/` | Invented sample data. Two files: a board seed and a one-morning digest |
| `designprompt.md` | The Claude Design brief for the token layer |
| `vercel.json` | `cleanUrls: true` |
| `package.json` | Metadata only. No deps, no scripts. Nothing reads it |

## Non-negotiables

Each of these was decided deliberately, several after getting it wrong first. Do not undo them
while chasing a feature.

1. **An import must never overwrite the human's triage.** `status`, `hidden`, `notes` and
   `first_seen` belong to her. On re-import the agent's fields refresh and those four are left
   exactly as they are. Without this rule Tuesday's digest silently resets Monday's triage and
   the tool is worse than a spreadsheet. The prompts are written so the agent never emits the
   three human fields at all, and `merge()` in `app.js` ignores them for existing rows.
2. **Applied roles do not come back.** A row whose status is applied, interviewing, offer or
   closed is not listed in the daily results while the status filter is `all`. That is the
   `DONE` array in `app.js`. Combined with rule 1, it is what stops a role reappearing every
   morning after she has actioned it. It is a **filter, not a delete**: the pipeline rows and the
   status filter both bring it back.
3. **The hard constraints are filters, and they run before scoring.** `prompts/scoring-rubric.md`
   step 0. A role she cannot legally start is not a low score, it is not a record: emitting it
   produces a digest of great-fit roles that are not actionable, which is the failure this repo
   exists to prevent.
   - **United States only.** No Dubai, no UK, no non-US-eligible remote.
   - **New York City or remote-US.** This replaces an earlier rule that said there was no
     geographic preference inside the US. There is: she is at Cornell Tech in New York from August
     2026 to May 2027 and cannot relocate to a third city mid-programme. **San Francisco is not
     actionable while enrolled**, and is worth emitting only where the company has a New York
     office, with the constraint named in the rationale.
   - **F-1, and authorization is timing-gated.** Full-time start dates on or after **May 2027**,
     internships **summer 2027**. The clean CPT window is summer 2027, after one full academic year.
     A **stated** earlier start is dropped. A posting stating **no** start date, which is most of
     them, is emitted with a 25-point deduction: dropping those would empty the digest, and exempting
     them would make the filter meaningless. Do not collapse those two cases back together, and if
     you change one file here change all four: this rule lives in `prompts/profile.md`,
     `prompts/scoring-rubric.md`, `prompts/daily-search.md` and this list, and it was inconsistent
     across them once.
   - **Tier 4 roles are not sourced**: GTM Engineer at a lab, FDE or Applied AI Engineer against a
     real SWE bar, SWE, MLE.
4. **Classify on the requirements section, not the title.** "Forward deployed" and "AI deployment"
   are two different jobs under near-identical titles, and some manager-titled deployment roles
   smuggle in a coding screen. Get this wrong and the top-scored role of the day is regularly a
   coding loop. Relatedly, **"AI" in a title is noise**: score the work described, which is
   enterprise accounts, post-sales, adoption and non-technical end users.
5. **GTM is a target, not experience.** She has no GTM, partnerships, BD or RevOps title on record,
   and no PM title either. Both are Tier 2 and Tier 3 targets that get surfaced with the gap named
   in the rationale. Do not let five commercial years imply a GTM role, and do not relabel account
   management as GTM anywhere.
6. **Precision beats impressiveness on every claim about her.** "29 duplicates removed" is not "29
   rows rejected"; the rejection count is 0. She has been questioned hard on claims before, and a
   claim that unravels is worse than a weaker one that holds. This is why
   `prompts/resume-tailor.md` requires the tailoring step to output a **diff against the master**
   rather than a clean file: a clean file hides a number that drifted, a diff cannot.
7. **Never claim a metric about the system.** There is no weeks-running, applications-sent,
   interview count or time-saved figure anywhere, and there should not be. No baseline for the
   manual search was ever measured, so any number would be an estimate dressed as a measurement.
8. **Never publish real pipeline data.** All sample rows are invented. No real employer, posting,
   score, or status appears in this repo. A screenshot of the live board shows which companies
   she is applying to and what an agent scored them, so **do not commit one**: capture the app
   running the sample data instead.
9. **No em dashes.** Stated preference. Commas or full stops. This applies to the prompt files
   too, because they generate her email.
10. **Contact is `dk947@cornell.edu`** everywhere. Search case-insensitively when replacing it: an
    all-caps gmail address survived a case-sensitive pass once on the portfolio site.
11. **Every outbound link opens in a new tab** with `rel="noopener"`.
12. **Nothing in this repo touches `duaakhalid-site`.** Different project, different design
    system, different repo. The portfolio deliberately does not carry a job-search project block.

## The board lives in localStorage

Key `jsd.board.v1`, shape `{version, updated, items[]}`. Nothing is uploaded and there is no
server, which is deliberate: this is a live record of where she is applying.

Two consequences worth stating before someone "fixes" them:

- **Clearing browser data clears the board.** `Export` is the backup. There is no sync.
- **A phone and a laptop are separate boards.** Deploying the app publicly does not change that,
  because the data never leaves the browser it was entered in.

The key is versioned so a future schema change can migrate rather than clobber. If the record
shape changes, bump to `jsd.board.v2` and write the migration.

## The dedup key

`url`, normalised: lowercased, query string and fragment stripped, trailing slash removed.
Falling back to `company|title|location` with punctuation removed and whitespace collapsed.

The normalisation is load-bearing, not tidiness. The morning digest arrives with
`?utm_source=digest` on the same posting that is already on the board, and without stripping the
query it would import as a duplicate. `data/sample-digest.json` contains exactly that case on
purpose, so the behaviour has a test.

## Validation is more forgiving than the schema

Deliberate asymmetry. The schema states what the agent **should** emit; the validator decides
what the board will **accept**.

- **Rejected**, reported by row number: not an object, no `title`, no `company`, or a `score`
  that is not an integer from 0 to 100.
- **Coerced and reported as a warning**: an unknown `remote` becomes `unknown`, a `band` that
  disagrees with `score` is corrected (score wins, always), a non-http `url` is dropped, a
  missing `rationale` is flagged.

Losing a real opportunity to a missing enum value would be a worse failure than showing it with
a default. A bad morning from the model should produce a loud itemised report, not a silently
damaged board.

`band` is **always derived from `score`** in `bandOf()`. Never store a band the score does not
support, and do not add a UI that lets the two disagree.

## Gotchas, learned the hard way

- **The apply link lives inside `<summary>`.** Its click bubbles up and toggles the fold as a
  side effect, so the delegated handler calls `stopPropagation()` for `data-act="applylink"`.
  Remove that and clicking Apply also expands the row. There is a browser test for it.
- **`.row-co` and `.row-title` must stay `display: block`.** As inline spans they rendered on one
  line with no separator, so the employer ran straight into the role title:
  `LUMINA SYSTEMSAI Deployment Manager`. Caught only by comparing a screenshot against the
  reference, not by any grep.
- **Rows are re-rendered on every change**, so all row handlers are **delegated** from
  `document`. Do not attach listeners to row elements directly; they will be dropped on the next
  render.
- **`Load sample data` uses `fetch`**, so the folder has to be served over http. Opening
  `index.html` as a file shows a toast saying so rather than failing silently.
- **Pipeline rows are `<button>`s**, not styled divs, because they filter the board and therefore
  need keyboard operation and a real focus ring.
- **Headless Chrome clamps its window to about 500px wide.** `--window-size=390,x` crops instead
  of reflowing, which looks exactly like a horizontal-overflow bug. Test mobile by loading the
  page in a 390px-wide **iframe**.
- **Greps prove nothing about what renders.** Finish in a real browser.

## Verifying a change

There is no test framework and no dependency to add one. The check is a browser script, and the
five that matter:

1. Import the sample twice: the second time must report `0 added, 10 updated`.
2. Set a status by hand, then re-import: **the status must survive.** This is rule 1 and it is
   the most important assertion in the repo.
3. Mark a role applied, then re-import the whole digest: **it must not return to the list.**
4. Import a row with no title and a row with `score: 999`: both rejected by row number, the good
   row still lands.
5. 390px iframe: `scrollWidth` must equal `clientWidth`.

Run the app with `python3 -m http.server 8000`. Drive it with Playwright against the
pre-installed Chromium rather than downloading one.

## Two stages, kept separate

```
sourcing                    scoring                     triage
fetch_jobs.py ----------->  Claude scheduled task ----> the dashboard
(or the agent's search)     (or the keyword prescore)
```

`fetch_jobs.py` sources and applies a **transparent keyword prescore** from `ingest/rubric.json`.
Every rationale it writes begins `Keyword prescore, not a judgment` and lists which rules
matched, because a keyword count is not a fit assessment and must not be dressed as one. The
agent's scores overwrite it on import, since `score` is agent-owned.

Keep it that way round: the deterministic path is the default and the model is the upgrade, not
the dependency. If the agent is unavailable or its output looks wrong, there is still a working
pipeline and something to compare against.

## Open items

- **`ingest/sources.json` tokens are unverified.** They are the conventional careers-page tokens
  but could not be confirmed, because the sandbox this was built in blocks job-board hosts. Run
  `python3 ingest/fetch_jobs.py --only greenhouse --only ashby` and prune the `FAIL` lines.
- **Design values in `styles.css` were read off a screenshot**, so they are approximate. They are
  all in one `:root` block precisely so a measured design system can replace them without
  touching anything else.
- **No Apify adapter.** LinkedIn and Indeed have no legitimate API. Adding one is about fifteen
  lines in `ADAPTERS` plus a paid token, and it is a real decision about terms of service and
  cost rather than a default. See `SOURCES.md`.
- **Adzuna is disabled** pending `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
- **No sync between devices.** See the localStorage section. Adding one means adding a backend,
  which means her pipeline leaves her machine. That is a real tradeoff, not an oversight.
