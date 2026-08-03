# Where the jobs come from

You asked whether to use Composio or Apify. Short answer: **neither, to start.** Here is the
honest landscape.

## The tiers, best signal first

### Tier 1: employer ATS boards. Free, no key, no terms-of-service problem.

Reading a company's own applicant tracking system is the highest-signal source available. If a
posting is on the employer's board today, the search is live. That is a fact about the world,
not an inference, and it is what the `signal` field in `CONTRACT.md` records. Aggregators
cannot tell you this, which is why a stale listing can sit on a job site for months after the
role is filled.

| ATS | Endpoint | Key |
| --- | --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | none |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{token}` | none |
| Lever | `api.lever.co/v0/postings/{token}?mode=json` | none |
| Workable | `apply.workable.com/api/v1/widget/accounts/{token}?details=true` | none |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{token}/postings` | none |

All five have adapters in `ingest/fetch_jobs.py`. The cost of this tier is that it is a
**watchlist**: you have to name the companies. For a search aimed at specific AI labs and
platform companies, that is a feature rather than a limitation, because those are exactly the
employers worth checking every morning.

### Tier 2: aggregators, for breadth.

| Source | Key | Notes |
| --- | --- | --- |
| Adzuna | free app id and key | Real breadth, proper search and location filters. Adapter included, disabled until you add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` |
| Remotive | none | Remote roles only. Adapter included and enabled. Measured 2026-08-03: the free feed served 31 postings in total and the `search` parameter changed nothing about which 31 came back, so treat it as a small unfiltered feed the prescore has to sift, not as a search |
| Arbeitnow | none | Free board feed. Adapter included, disabled by default |

### Tier 3: LinkedIn and Indeed. This is where the honesty matters.

**LinkedIn has no public jobs-search API.** Its Job Posting API is a partner programme for
posting jobs, not searching them, and scraping job listings is against the User Agreement. So
there is no clean way to do it, and I am not going to pretend the adapter I could write for
you would be fine. **Indeed** is the same story: the old publisher API was retired and access
is partner-only now.

That leaves two legitimate options for LinkedIn coverage:

1. **Apify** (or a similar hosted scraper). Their LinkedIn Jobs and Indeed actors work, cost
   money per thousand results, and carry both terms-of-service risk and breakage risk, because
   a scraper follows a page layout that its target is free to change. If you want it, the
   `ADAPTERS` dict in `ingest/fetch_jobs.py` is one function per source, so an Apify adapter is
   about fifteen lines plus a token. Say the word and I will add it. **I have not added it
   speculatively**, because it needs a paid account and it is your call whether that tradeoff
   is worth making.
2. **Let the agent browse.** A Claude scheduled task with web search can look at LinkedIn the
   way a person does, and a human-directed search of a public page is a different thing from
   running a scraper at volume. This is what `prompts/daily-search.md` already does, and for a
   handful of roles a morning it is honestly enough.

### Composio

Composio is an authentication and tool-calling layer for agents, with connectors for a few
hundred SaaS apps. It is genuinely useful, but **not for this**: it does not give you job
listings. Where it would earn its place is the delivery side, if you later want the agent
writing to Gmail, Google Sheets or Notion under a managed OAuth connection instead of you
copying JSON into the dashboard. Worth revisiting then. Not now.

## The recommendation

Start with tier 1 plus Remotive, which is free, clean, and needs no account. Add Adzuna when
you want breadth, because the key takes two minutes. Only reach for Apify if a week of running
the thing shows you are genuinely missing roles that only appear on LinkedIn, and treat that as
a real decision about cost and terms rather than a default.

## Two stages, kept separate

```
sourcing                      scoring                    triage
fetch_jobs.py  ------------>  Claude scheduled task  --> the dashboard
(or the agent's web search)   (or the keyword prescore)
```

`fetch_jobs.py` **sources**. It emits contract-shaped records with a transparent keyword
prescore from `ingest/rubric.json`, so the output is importable with no model involved at all.
Every rationale it writes says `Keyword prescore, not a judgment` and lists which rules
matched, because a keyword count is not a fit assessment and should not be dressed as one.

The **agent** scores properly, with the profile and the rubric in `prompts/scoring-rubric.md`.
Its scores overwrite the prescore on import, since `score` is an agent-owned field.

That split is deliberate: the deterministic path is the default and the model is the upgrade,
not the dependency. If the agent is unavailable, or its output looks wrong, you still have a
working pipeline and something to compare against.

## The tokens in `ingest/sources.json` were verified live

On **2026-08-03** every employer token in that file was requested against its ATS endpoint. A
token counts as verified only if the endpoint returned HTTP 200 **and** the body parsed as the
expected shape **and** it carried at least one posting. 70 boards passed: 43 Greenhouse, 25
Ashby, 2 Workable. Together they were serving **10,200 live postings** that morning.

The board's own name was checked as well, because a 200 does not prove whose board it is. The
Ashby token `runway` is **cfo.ai**, not Runway ML, so Runway ML sits in the file disabled rather
than quietly pulling a different company's jobs. That check is the reason to read a board's name
and not just its status code.

18 companies worth watching could **not** be confirmed, and they are in the file with
`"enabled": false` and a `_note` recording what the endpoint actually returned, so nobody
re-guesses the same misses. The list includes Retool, HashiCorp, dbt Labs, Rippling, Sourcegraph,
Grammarly, Ironclad, Deel, Etsy, Vimeo, DigitalOcean, Lemonade, Chainalysis, Mistral AI, Hebbia
and Runway ML. Several of those returned 200 with zero postings on a plausible token, which is
not the same thing as a live board and was not treated as one.

**A token is not a promise about tomorrow.** Companies move ATS. Re-run this when a familiar
employer goes quiet:

```
python3 ingest/fetch_jobs.py --only greenhouse --only ashby --only workable
```

Every source is fetched inside its own try block, so a moved token prints one `FAIL` line with
an HTTP 404 and the run continues. Fix or disable the failures, then trust the list.
