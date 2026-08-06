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
| `ingest/check_links.py` | **Is the posting still open?** Asks the employer's board feed, never an HTTP status |
| `ingest/rubric.json` | Weights for the deterministic keyword prescore |
| `ingest/sources.json` | The employer watchlist. Tokens are **unverified**, see `SOURCES.md` |
| `resume/master-resume.md` | **The master resume**, the AI PM and GTM variant. The tailoring input |
| `resume/Duaa-Khalid-resume-CSM.pdf` | The CSM variant as exported. Layout reference only, never tailor from it |
| `resume/README.md` | Why the markdown is the master, plus the open resume issues checklist |
| `resume/render.mjs` | Markdown to a one-page PDF. Exits non-zero when a tailored file overflows |
| `tests/check.mjs` | Browser assertions. Playwright, ad hoc, **not** a repo dependency |
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
     them, is emitted with `"timing": "unstated"`: dropping those would empty the digest, and
     exempting them would make the filter meaningless. Do not collapse those two cases back together,
     and if you change one file here change all four: this rule lives in `prompts/profile.md`,
     `prompts/scoring-rubric.md`, `prompts/daily-search.md` and this list, and it was inconsistent
     across them once.
   - **The start-date penalty lives in the ordering, never in the score.** `score` is fit. `timing`
     is whether she can start. `rank()` in `app.js` subtracts 25 for an `unstated` start when sorting,
     the row shows a `start unstated` chip, and the top card prefers an actionable role, so an
     unactionable posting still cannot head the morning.

     **Do not put it back in the score.** It has been tried twice. A flat cap at 70 rendered fit of
     90, 87, 84 and 79 all as exactly 70 and then sorted them alphabetically. Subtracting 25 fixed
     the ordering and destroyed the meaning: almost no posting states a start date, so every row took
     the hit, 75 became the arithmetic ceiling, the strong band became **unreachable**, all nine rows
     of the 2026-08-03 digest rendered `weak`, the 90-plus tile read a permanent 0, the 90-plus
     section of the Agent brief could never populate, and OpenAI's AI Deployment Manager was published
     as **68** when it fits her at **93**. She read that as the search finding nothing good.
   - **Posting age is not a filter and not a signal.** Confirm a posting is live, then ignore how long
     it has been live. OpenAI and Anthropic hold the same titles open for months and refresh the
     requisition rather than reposting, so `posted` dates at a lab run to months: 133 days for
     OpenAI's deployment role, 122 for Anthropic's CSM, 283 for Harvey. Those are her top-tier
     targets. A recency filter would delete the top of the board and keep the low scorers. Do not add
     a staleness deduction and do not report posting age as a quality signal.
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

## The loop is open in one direction, and that is the interesting constraint

The agent writes to the board by **committing its digest to `data/digests/`**, which the board imports
on load. That closes the outbound half without a server: the routine pushes, the deploy updates, and
the board fills itself. `data/digests/index.json` exists because a browser cannot list a directory, and
the ledger in `localStorage` under `jsd.digests.v1` is what stops a reload re-importing and bumping
`last_seen` on the whole board.

Auto-import goes through the same `merge()` as a paste, deliberately. That is where triage
preservation, the dedup keys and the applied-does-not-return filter live, so there must never be a
second import path.

**The board still cannot write back.** Everything the scheduled task gets wrong on a repeat morning
traces to that remaining half:

- it re-emits a role she applied to, because it cannot see that she did
- it re-sells a role she deliberately hid, which reads as the search not listening
- the Friday roundup cannot answer "what is still unactioned at 90 plus", the one section with a
  deadline attached

The fix is not a backend. It is the **Agent brief** button, which produces the smallest text that
closes the loop: the skip list, and the unactioned 90-plus list. She pastes it into the scheduled
task or hosts it somewhere the task fetches. Both prompts say what to do when it is absent, which is
to say so in one line rather than guess, because a model guessing at her triage is wrong in the
section she most needs to trust.

Do not "fix" this by adding a server. Her pipeline leaving her machine is the thing the whole design
is avoiding, and it is stated as a tradeoff in the README rather than an oversight.

## The board lives in localStorage

Key `jsd.board.v1`, shape `{version, updated, items[]}`. Nothing is uploaded and there is no
server, which is deliberate: this is a live record of where she is applying.

Two consequences worth stating before someone "fixes" them:

- **Clearing browser data clears the board.** `Export` is the backup. There is no sync.
- **A phone and a laptop are separate boards.** Deploying the app publicly does not change that,
  because the data never leaves the browser it was entered in.

The key is versioned so a future schema change can migrate rather than clobber. If the record
shape changes, bump to `jsd.board.v2` and write the migration.

Three other keys, all of them deliberately **not** part of the board record, so none of them travels
in an export or gets restored over the top of newer state: `jsd.digests.v1` is the import ledger,
`jsd.token.v1` is the digest token, and `jsd.notices.v1` is the last import's report.

## What an import flagged has to outlive the import

`merge()` itemises every rejected row, every coerced field and every retitled-repost match. On the
manual path that lands in the dialog, where she is already looking. **On the automatic path there is
no dialog**, and the account used to go to a toast that clears itself after four seconds while
everything else was dropped, so a morning that rejected a row looked exactly like a clean morning.
An import that runs while nobody is watching is precisely the one whose report cannot be the one that
disappears.

So the report is persisted under `jsd.notices.v1` and rendered twice, and the split is the point:

- **The band above the results** is the interruption. It appears **only** when something needs a look,
  and it is dismissible. Dismissal is keyed to the report's own content hash, so tomorrow's import
  raises a fresh band rather than inheriting today's dismissal.
- **The rail card** is the record. It is there after any import, says how the import arrived, and
  offers a way back to a dismissed band, because a rejected row dismissed into nowhere is the silent
  loss the band exists to prevent.

Do not make the band unconditional. A panel that says something every morning becomes wallpaper, and
the morning it carries a real rejection is the morning it needs to be unusual. That is also why
posting age is not in it: see the evergreen-requisition rule in non-negotiable 3.

## A posting closing is not an HTTP 404

Postings come down. The board has to say so, and the obvious way of finding out does
not work.

**A status code tells you nothing here.** Measured across the twenty roles of the
2026-08-03 digest: **all twenty returned HTTP 200**, including three that were no
longer listed. Ashby and Greenhouse serve a client-rendered shell, about 7KB of
loader markup, at the same 200 whether the requisition behind it is open, closed or
never existed. The "no longer accepting applications" line is painted in afterwards by
JavaScript. So a HEAD-request checker reports a clean board every morning and is worse
than none, because it is trusted.

`ingest/check_links.py` asks the **employer's own board feed** instead, the same
endpoint `fetch_jobs.py` sources from. A posting is open if and only if the board still
lists its id, and Ashby says so outright with `isListed`. Postings are grouped by
employer, so a check costs one request per board rather than one per row, and the whole
413-role backlog would still be about seventy requests.

Three verdicts, and the third is not a failure. `open`, `gone`, and `unknown` meaning
no feed could be read. **Never report `unknown` as `gone`**: it is a fact about the
checker, not about the job. Where a company fronts its ATS with its own domain, and
Asana and Harvey both do, the ATS is looked up by company name in `ingest/sources.json`,
which is the reason those two went from unverifiable to checked.

The result lands in `data/digests/<token>/liveness.json`, read on load, rendered as a
`posting closed` chip and a rail card that appears **only when something has actually
closed**, for the same reason the import band is conditional.

**It never changes a status and never removes a row.** A closed posting is information,
not a decision, and status is hers under non-negotiable 1. If she already applied, the
posting closing does not undo the application, and the card says so in as many words.

## The dedup key

Two keys, and a row matches on **either**:

1. `url`, normalised: lowercased, query string and fragment stripped, trailing slash removed.
2. `company|title`, lowercased, punctuation removed, whitespace collapsed.

**`location` is deliberately not in the second key.** It used to be, and it made the key useless
against a real aggregator: the same posting arrives as `New York, NY` from the employer board and
`New York, New York` or `New York, NY (Hybrid)` from a job site. Each variant landed a fresh row at
status `new`, so a role she had applied to came straight back into the daily list, which is exactly
what non-negotiable 2 exists to prevent. Measured before the fix: three location variants produced
four Lumina rows with statuses `applied, new, new, new`.

The tradeoff, stated so nobody re-adds it: two genuinely different roles with the same title at the
same company in two cities now merge into one row. Rare, the search is New York and remote-US only,
and one row instead of two is a much smaller failure than an applied role reappearing every morning.

The remaining hole is a **title** rewrite, `AI Deployment Manager - New York`, which no string key
catches. That is why the Agent brief carries the canonical URL on every skip row: the agent can match
on a URL even when the title has been mangled.

The normalisation is load-bearing, not tidiness. The morning digest arrives with
`?utm_source=digest` on the same posting that is already on the board, and without stripping the
query it would import as a duplicate. `data/sample-digest.json` contains exactly that case on
purpose, so the behaviour has a test.

## Validation is more forgiving than the schema

Deliberate asymmetry. The schema states what the agent **should** emit; the validator decides
what the board will **accept**.

- **Rejected**, reported by row number: not an object, no `title`, no `company`, or a `score`
  that is not an integer from 0 to 100.
- **Coerced and reported as a warning**: an unknown `remote` becomes `unknown`, an unknown `timing`
  becomes `unknown`, a `band` that disagrees with `score` is corrected (score wins, always), a
  non-http `url` is dropped, a missing `rationale` is flagged.

Losing a real opportunity to a missing enum value would be a worse failure than showing it with
a default. A bad morning from the model should produce a loud itemised report, not a silently
damaged board. That report is now kept rather than toasted: see the import-record section above.

`band` is **always derived from `score`** in `bandOf()`. Never store a band the score does not
support, and do not add a UI that lets the two disagree.

An **absent** `timing` becomes `unknown` **quietly**, with no warning, because a digest written before
the field existed carries a score that already had the 25 subtracted. There is no way to tell which
is which, so the row keeps its number and takes no ordering penalty rather than being penalised
twice. The next morning's digest re-emits the same posting and corrects it. `unknown` is a migration
state, not something an agent should ever emit.

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
- **`vercel.json` takes no comments, and an unknown key fails the whole deploy.** Vercel validates
  the file against a strict schema and rejects additional properties, so a `"_comment"` inside the
  `headers` entry errored every deploy from the moment it was added. The failure is quiet in the worst
  way: production keeps serving the **last deploy that built**, so the site is up, looks fine, and is
  simply weeks out of date. That presented as an empty board and a 404 on a digest that was provably
  committed to `main`, and it cost an afternoon of debugging the import path, which was never broken.
  Explanations for anything in `vercel.json` go here, not in the file. **After a change to
  `vercel.json` or `.vercelignore`, check the deployment actually built** rather than assuming a green
  site means a green deploy: `curl -sI <site>/app.js` and confirm the content matches `main`.
- **The `no-store` header on `/data/digests/(.*)` is load-bearing.** Without it the CDN hands back
  this morning's `index.json` from before the routine committed: she opens the site at 08:05, the
  digest landed at 08:00, and the board shows nothing, which reads as broken code rather than a cache.
  A digest file is immutable once written, but a corrected re-push has to win, so it applies to both.
- **Greps prove nothing about what renders.** Finish in a real browser.
- **A big employer board will not come back through a page fetcher.** OpenAI's Ashby board is over
  11MB and more than 700 postings, and a 10MB fetch limit failed it **silently**. The morning run
  fell back to a web search, surfaced 1 role instead of about 10, and missed two Tier 1 New York
  reqs including `AI Deployment Manager - NYC`, which is the most on-target title in
  `prompts/profile.md`. Enumerate a board with `curl` piped into a parser; use a page fetcher only
  for an individual posting. The digest looked like a thin market and was a tooling failure.
- **The watchlist is the ceiling on the digest.** `ingest/sources.json` had seven employers, and
  two of those were broken: Notion's token was a Greenhouse token while Notion is on Ashby, so it
  404d. Seven employers cannot produce a 15 to 20 role morning. When the count falls short, check
  the watchlist before concluding the market is quiet, and note that for the **Tier 2 GTM family
  any technology company counts**, so a watchlist of only AI-native companies starves that family
  and Tier 3 entirely.

## Verifying a change

There is no test framework and no dependency to add one. The check is a browser script, and the
seven that matter:

1. Import the sample twice: the second time must report `0 added, 10 updated`.
2. Set a status by hand, then re-import: **the status must survive.** This is rule 1 and it is
   the most important assertion in the repo.
3. Mark a role applied, then re-import the whole digest: **it must not return to the list.**
4. Import a row with no title and a row with `score: 999`: both rejected by row number, the good
   row still lands.
5. 390px iframe: `scrollWidth` must equal `clientWidth`.
6. Import a `score: 93, timing: "unstated"` row next to a `score: 80, timing: "actionable"` one:
   the **93 must display as 93**, the 90-plus tile must count it, and the **80 must sort above it**.
   That is the whole fit-versus-actionability split in one assertion.
7. Import a digest with a rejected row, then reload: **the report must still be on screen.** Dismiss
   it, reload again, and it must stay dismissed with a way back in the rail.
8. Import two postings from the **same** board whose titles differ by a real word, and two whose
   titles differ only by a place: the first pair must stay **two rows**, the second must merge to
   **one**. Both halves matter. Merging too eagerly deleted a Tier 1 role, merging too little brings
   an applied role back.

Run the app with `python3 -m http.server 8000`. Drive it with Playwright against the
pre-installed Chromium rather than downloading one.

`tests/week.mjs` fixtures carry **no** `timing` on purpose, so the five-day simulation doubles as the
migration check: a board of pre-`timing` rows must order by score alone and take no penalty.

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

- **The watchlist is verified, and volume is capped by the prompt rather than by supply.** Every
  token in `ingest/sources.json` was requested live on 2026-08-03: 70 boards pass, 18 could not be
  confirmed and sit `enabled: false` with a `_note`. The old seven-employer list had a dead one in
  it, `greenhouse/notion`, which 404s. Notion is on Ashby.

  Measured the same morning across 67 boards: **11,654 live postings, of which 413 survive every
  step 0 filter**, 156 of them Tier 1. The **six** live boards the old file actually read were
  already holding **100** eligible roles. So an 8-role digest was never the market talking. The
  binding constraint is the `Aim for 8 to 15 postings` line in `prompts/daily-search.md`, and the
  watchlist is only the second ceiling behind it.

  **Stock and flow are different questions, and the daily cap is right for one of them.** New
  eligible roles arrive at roughly 8 or 9 per weekday, inferred by scaling a measured Ashby subset
  where `publishedAt` is a true first-publish date, so 8 to 15 is the correct order of magnitude for
  a morning. It is the **backlog** the cap cannot serve: median survivor age is 55 days and 413
  roles have never been seen, so at 8 a morning it takes months. Do not fix that by raising the
  daily number, which would flood a morning she has to triage by hand. It wants a separate one-time
  catch-up sweep.

  Re-run `python3 ingest/fetch_jobs.py --only greenhouse --only ashby --only workable` when a
  familiar employer goes quiet: companies move ATS, and a moved token prints one `FAIL` line rather
  than breaking the run.
- **Design values in `styles.css` were read off a screenshot**, so they are approximate. They are
  all in one `:root` block precisely so a measured design system can replace them without
  touching anything else.
- **No Apify adapter.** LinkedIn and Indeed have no legitimate API. Adding one is about fifteen
  lines in `ADAPTERS` plus a paid token, and it is a real decision about terms of service and
  cost rather than a default. See `SOURCES.md`.
- **Adzuna is disabled** pending `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
- **No sync between devices.** See the localStorage section. Adding one means adding a backend,
  which means her pipeline leaves her machine. That is a real tradeoff, not an oversight.
