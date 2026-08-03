# The agent-to-dashboard contract

The dashboard is only useful if the agent's output has a fixed shape. This file is that shape.

The agent proposes, the schema constrains, the human decides. A bad day from the model
degrades into a rejected import rather than a corrupted board.

## One opportunity

Nineteen fields exist on a record **on the board**. The agent emits **twelve** of them. The other
seven are not the agent's to send: three belong to the human and four are derived or assigned by the
dashboard, and the ownership table below is the authority on which is which.

The dashboard never branches on a missing key, so the agent emits **all twelve of its own fields on
every record**, even when a value is empty or unknown.

The exact twelve: `title`, `company`, `location`, `remote`, `source`, `url`, `apply_url`, `posted`,
`score`, `rationale`, `signal`, `resume_tailored`.

| Field | Type | Owner | Notes |
| --- | --- | --- | --- |
| `id` | string | dashboard | Stable hash of the dedup key. The agent may omit it; the dashboard fills it |
| `title` | string | agent | Role title exactly as posted, no editorialising |
| `company` | string | agent | Employer, not the job board |
| `location` | string | agent | As posted, for example `New York, NY` |
| `remote` | enum | agent | `onsite`, `hybrid`, `remote`, `unknown` |
| `source` | string | agent | Where it was found: `greenhouse`, `ashby`, `lever`, `adzuna`, `linkedin`, `company_site` |
| `url` | string | agent | Canonical posting URL. This is the primary dedup key, so it matters |
| `apply_url` | string | agent | Direct application link. Same as `url` when there is no separate one |
| `posted` | date | agent | `YYYY-MM-DD`, or `""` when the posting does not say |
| `first_seen` | date | dashboard | First import that contained this posting |
| `last_seen` | date | dashboard | Most recent import that contained it |
| `score` | integer | agent | 0 to 100. See `prompts/scoring-rubric.md` |
| `band` | enum | dashboard | Derived from `score`: `strong` at 90 and above, `possible` 70 to 89, `weak` below 70. The agent may emit it, but `score` wins and any disagreement is reported |
| `rationale` | string | agent | One sentence on why it could fit. No hedging, no filler |
| `signal` | string | agent | The evidence that the search is live, for example `employer greenhouse page active, reposted 2026-07-28` |
| `status` | enum | **human** | `new`, `saved`, `applied`, `interviewing`, `offer`, `closed` |
| `hidden` | boolean | **human** | Ruled out. Hidden, never deleted |
| `notes` | string | **human** | Free text |
| `resume_tailored` | boolean | agent | True when the digest shipped a tailored resume for this one |

## Who owns what

This split is the whole design.

- **The agent owns** `title` through `signal`, plus `resume_tailored`. It may overwrite these on
  every import.
- **The human owns** `status`, `hidden` and `notes`. The agent must never emit a value for these
  that overwrites a decision already made. If it emits them at all they are treated as defaults
  for records the board has not seen before.
- **The dashboard owns** `id`, `first_seen` and `last_seen`.

## The dedup key

The same posting arrives on two boards and on two mornings. Without a key, Tuesday's import
silently resets Monday's triage.

1. If `url` is present, the key is the URL **normalised**: lowercased, query string and fragment
   stripped, trailing slash removed.
2. Otherwise the key is `company|title|location`, each part lowercased, punctuation removed and
   whitespace collapsed.

## Merge policy on re-import

Keep the human's state, refresh the agent's fields.

| On import | Behaviour |
| --- | --- |
| Key not on the board | Insert. `status` defaults to `new`, `hidden` to `false`, `notes` to `""`. `first_seen` and `last_seen` set to today |
| Key already on the board | Update `title`, `company`, `location`, `remote`, `source`, `url`, `apply_url`, `posted`, `score`, `band`, `rationale`, `signal`, `resume_tailored`. Bump `last_seen`. **Leave `status`, `hidden`, `notes` and `first_seen` untouched** |
| Row fails validation | Reject that row, report it, and import the rest |

A rejected row is never partially applied.

## How strict validation actually is

The schema above is the **agent's obligation**. The dashboard is deliberately more tolerant
than the schema, because losing a real opportunity to a missing enum value would be a worse
failure than showing it with a default.

- **Rejected**, and reported by row number: not an object, no `title`, no `company`, or a
  `score` that is not an integer from 0 to 100.
- **Coerced, and reported as a warning**: an unrecognised `remote` becomes `unknown`, a `band`
  that disagrees with `score` is corrected, a non-http `url` is dropped, a missing `rationale`
  is flagged.

So a bad day from the model produces a loud, itemised import report, not a silently damaged
board.

## What the agent emits

A single JSON array, nothing else, no prose around it, no markdown fence in the payload the
human pastes:

```json
[
  {
    "title": "AI Deployment Manager",
    "company": "Lumina Systems",
    "location": "New York, NY",
    "remote": "hybrid",
    "source": "greenhouse",
    "url": "https://boards.greenhouse.io/luminasystems/jobs/4820193",
    "apply_url": "https://boards.greenhouse.io/luminasystems/jobs/4820193#app",
    "posted": "2026-07-24",
    "score": 96,
    "rationale": "Post-sales adoption ownership for an enterprise AI platform, which is the closest match to the deployment-manager track and to the field rollout she has already run.",
    "signal": "employer greenhouse page active, reposted 2026-07-28",
    "resume_tailored": true
  }
]
```

`status`, `hidden` and `notes` are deliberately absent from that payload. That absence is the
contract working.

`band` is absent too, and used to be present here while `prompts/daily-search.md` said to omit it.
The dashboard always derives it from `score`, so emitting it can only create a disagreement to
report. `id`, `first_seen` and `last_seen` are assigned on import.
