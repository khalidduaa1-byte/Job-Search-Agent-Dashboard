# Job Search Agent & Dashboard

A scheduled Claude task finds roles every weekday morning, scores them against one written
rubric, tailors a resume for the best one, and emails the lot. This repo is the other half: the
board where they get triaged, and the prompts and the data contract that make the two fit
together.

Three hand-written files for the app, no build step, no framework, nothing to install. Open
`index.html` over http and it runs.

One external request, and it is worth naming rather than claiming zero: `index.html` pulls
Playfair Display and Inter from Google Fonts. Nothing else leaves the page, the board itself
never does, and the page degrades to Georgia and the system sans if the request fails or you
are offline. Delete the two `<link>` tags if you would rather it made no outbound request at
all, and the layout holds.

## Why it is a repo and not a chat thread

The search itself works fine inside a chat product. The problem is that everything load-bearing
lives there too: the scoring brief, the tailoring rules, the board, the state. None of it can be
diffed, reviewed, improved, or handed to anyone.

So the parts worth keeping are here as files:

| File | What it is |
| --- | --- |
| `CONTRACT.md` | The agent-to-dashboard data contract, and the merge policy |
| `schema/opportunity.schema.json` | The machine-readable version of one opportunity |
| `prompts/profile.md` | The verified profile. The only source for factual claims |
| `prompts/scoring-rubric.md` | What a score means, including the caps |
| `prompts/daily-search.md` | The Monday to Thursday scheduled task |
| `prompts/weekly-roundup.md` | The Friday roundup |
| `prompts/resume-tailor.md` | Tailoring rules, as a diff against the master resume |
| `index.html`, `styles.css`, `app.js` | The dashboard |
| `resume/master-resume.md` | The master resume, the AI PM and GTM variant. What tailoring diffs against |
| `resume/README.md` | Why the markdown is the master, and the open resume issues |
| `tests/check.mjs` | 79 browser assertions over the behaviour above |
| `ingest/fetch_jobs.py` | Optional. Sources postings from employer ATS boards with no model involved |
| `SOURCES.md` | Where jobs come from, and why LinkedIn is not on the list |

## How it runs

```
Mon to Thu morning        the digest email             the board
Claude scheduled task --> scored list + JSON block --> paste into Import digest
   (prompts/daily-search.md)  + tailored resume         (localStorage, yours only)

Friday
Claude scheduled task --> the week's read, no JSON
   (prompts/weekly-roundup.md)
```

Optionally, ahead of the agent:

```
python3 ingest/fetch_jobs.py     # employer boards -> out/candidates.json
```

That path is deterministic. It applies a transparent keyword prescore from `ingest/rubric.json`
and labels every rationale `Keyword prescore, not a judgment`, so the pipeline works with no
model in the loop and you have something to check the agent's scores against. The agent's scores
overwrite the prescore on import, because `score` is an agent-owned field.

## Setting up the scheduled tasks

**`prompts/scheduled-task.md` has both prompts ready to paste**, plus the settings and the schedule.

**Create them from the claude.ai routines UI, not from an agent session.** That is not a style
preference. A routine created through the UI can attach a repository source and connectors, and its
runs appear in the sessions list. Routines created by an agent's `create_trigger` can attach neither,
and their runs return a `cse_...` identifier rather than `session_...`, which does not appear to
surface in the same place: three firings produced nothing visible.

Two routines, both firing at 05:00 UTC:

| Routine | Schedule | Reads |
| --- | --- | --- |
| `Job search: daily digest (Mon-Thu)` | `0 5 * * 1-4` | `prompts/daily-search.md` |
| `Job search: Friday roundup` | `0 5 * * 5` | `prompts/weekly-roundup.md` |

Each one reads its prompt, plus `prompts/profile.md`, `prompts/scoring-rubric.md` and
`resume/master-resume.md`, straight from this repo, so **editing a prompt here changes what next
morning's task does.** That is the point of keeping them as files: no routine needs re-pasting when
the rubric changes.

Two things worth knowing:

- **Web search has to be on.** Without it the task cannot verify a posting exists, and the prompt
  tells it to drop anything it cannot open.
- **05:00 UTC is 9am Dubai and 1am New York.** Change the hour to `11` when she moves, so it lands
  at 7am Eastern rather than in the middle of the night.

The digest arrives as the routine's output rather than as email, so it is read in the routines
dashboard and the JSON block is copied from there into **Import digest**.

### What tells you a morning went wrong

Almost nothing, and that is worth knowing rather than discovering. The triggers API records only
`last_fired_at`: no exit status, no error surface, no archive of the digest. A push notification fires
identically for a good morning and a hallucinated one, so it confirms a run happened and nothing more.

Three failures are the ones the prompts are most carefully written to prevent, and all three are
invisible from outside the session: the authorization filter not running, so the digest looks great
and every role is one she cannot legally start; invented postings; and the Friday roundup guessing at
what she has actioned.

So the digest carries its own tell, and it is worth one glance:

- **The routine's first line** says whether it could fetch the four prompt files and whether web
  search worked. A run that could not read the rubric says so instead of scoring from memory.
- **The "what the filters dropped" line.** If it is missing, or reads zero every day, the step 0
  filters are not running. On a real morning against a US-only, New-York-or-remote, May-2027-onward
  brief, that number is never zero.

## Running the dashboard

It needs to be served over http, not opened as a file, because the sample-data button uses
`fetch`.

```
python3 -m http.server 8000
# then open http://localhost:8000
```

Click **Load sample data** to see it populated with ten invented rows, or **Import digest** and
paste the JSON block from a real morning email.

### Deployed

<https://job-search-agent-dashboard.vercel.app>

Vercel builds from git, and there is no build step, so a push is a deploy. Pushing a branch gives a
preview URL; the address above updates when the change reaches the default branch.

Deploying it is safe for privacy, and that is a property of the design rather than a promise: the
board lives in `localStorage`, nothing is uploaded, and there is no server, so a stranger opening
that URL sees an empty board. The cost of the same property is that **a phone and a laptop are two
separate boards.** Deploying does not sync them. Fixing that means adding a backend, which means the
pipeline leaves the machine it was entered on, and that is a real tradeoff rather than an oversight.

### What it does

- **The report header** shows the latest report date and the day's best match, both derived from
  the board rather than stored, so they cannot drift from the rows.
- **The stat row** is four derived counts. Their definitions, so the numbers are auditable:
  - `ROLES IN VIEW`: every row not hidden
  - `90+ MATCH`: not hidden, score 90 or above
  - `APPLIED TO`: status is applied, interviewing or offer
  - `IN PROGRESS`: status is saved, applied, interviewing or offer, excluding hidden
  - These count the whole board, so `ROLES IN VIEW` stays larger than the daily list. The list
    shows what is left to action; the tiles show where the search actually stands.
- **Apply is in the row**, not behind the fold. One click, new tab, straight to the
  application. Clicking it does not expand the row.
- **Applied roles leave the daily list.** `Mark as applied` moves a role into the pipeline card,
  and the daily list only ever shows what is still actionable, so **a role you have applied to
  does not come back tomorrow.** It is not deleted: click the pipeline row, or pick the status in
  the filter, and it is back in view.
  - This holds across mornings, which is the point. The agent re-emits the same posting on
    Tuesday, the merge policy keeps the status you already set, and a row with a status of
    applied, interviewing, offer or closed is not listed. Verified in the browser: re-importing
    the whole digest after marking a role applied leaves the list unchanged.
- **Filtering** composes across free-text search, status and score band. The header count
  follows, and reads `N to action, M already in your pipeline` so the two numbers cannot be
  confused.
- **Status** is per row: new, saved, applied, interviewing, offer, closed. Saved immediately.
- **Hiding** moves a ruled-out role into `Hidden roles` in the right rail, with a `Restore`
  button. It is never deleted, and it stays in the export, so a decision is recoverable.
- **Notes** per row, for call prep and who you spoke to.
- **Export** downloads the whole board as JSON, hidden rows included.
- **Agent brief** copies the one thing the scheduled task cannot work out for itself: what she has
  already applied to or hidden, and what is still unactioned at 90 plus. The task has no read path to
  this board and never will, because there is no server, so without the brief it re-emits roles she
  has finished with and the Friday roundup cannot answer the question it is built around. Paste it
  into the task, or host it somewhere the task can fetch. Both prompts say what to do when it is
  missing, which is to say so rather than guess.

Hiding and applying are different actions on purpose. Hidden means *not for me*. Applied means
*done with, for now*. Both leave the daily list; only one of them is a judgment about the role.

### Where the data lives

`localStorage`, under `jsd.board.v1`, in your browser. Nothing is uploaded and there is no
server. That is deliberate: this board is a live record of where you are applying, and it should
not be sitting on someone else's machine. It also means **clearing your browser data clears the
board**, so use Export if you care about the history.

## The two ideas worth defending

**The shape is fixed.** The agent proposes, the schema constrains, the human decides. Because
the contract is written down, a bad morning from the model degrades into an itemised import
report instead of a corrupted board. Validation is deliberately more forgiving than the schema:
a row is rejected only when `title`, `company` or `score` is unusable, and everything else is
coerced with a reported warning, because losing a real opportunity to a missing enum would be
the worse failure.

**The human's triage survives the agent.** The same posting arrives on two boards and on two
mornings. On re-import, `score`, `rationale` and `signal` refresh, while `status`, `hidden` and
`notes` are left exactly as they are. Without that rule, Tuesday's import silently resets
Monday's triage, and the tool becomes actively worse than a spreadsheet. The prompts are written
so the agent never emits those three fields at all.

## What is not claimed

There is no metric here. No weeks-running, no applications-sent, no interview count, no
time-saved figure. The system runs and it is read every morning; there was never a measured
baseline for the manual search, so any number would be an estimate dressed as a measurement.

The design decisions above are the claim.

## Notes

- The design values in `styles.css` were read off a screenshot of the original dashboard, so
  treat them as approximate. They all live in one `:root` block so a real design system can
  replace them without touching anything else.
- The sample data in `data/` is invented. No real employer, posting, score or pipeline state is
  published in this repo.
- The company tokens in `ingest/sources.json` are unverified. See the end of `SOURCES.md`.
