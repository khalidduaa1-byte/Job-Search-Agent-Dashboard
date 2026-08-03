# The two scheduled tasks, ready to paste

Create both from the **claude.ai routines UI**, not from an agent session. The distinction is not
cosmetic: a routine created through the UI can attach a **repository source** and **connectors**, and
its fired runs appear in the sessions list. Routines minted by an agent's `create_trigger` cannot
attach either, and their runs come back with a `cse_...` identifier rather than a `session_...` one,
which appears not to surface in the same place. Three firings produced nothing visible.

So: UI, with the repo attached. Paste the text below into the prompt field.

## Settings for both

| Field | Value |
| --- | --- |
| Source repository | `khalidduaa1-byte/Job-Search-Agent-Dashboard` |
| Web search | **on**, and this is load-bearing. Without it the task cannot verify a posting exists, and the prompt tells it to drop anything it cannot open |
| Connectors | Gmail, only if you want it emailed. Both prompts work without it |
| Notifications | push and email on, so a run that happens at all is visible |

**Schedule.** Cron is UTC, so it has to be converted, and it does not follow daylight saving.

| Routine | Cron | Fires at |
| --- | --- | --- |
| Daily digest | `0 12 * * 1-4` | **8am New York**, 4pm Dubai |
| Friday roundup | `0 12 * * 5` | same |

**Twice a year this drifts by an hour and nothing warns you.** `12:00` UTC is 8am Eastern during
daylight time, which runs from mid-March to early November. Outside that window Eastern is UTC minus 5,
so the same cron fires at 7am. To keep 8am through the winter, change it to `0 13 * * 1-4` and
`0 13 * * 5` when the clocks go back.

Four searches and one review, and **do not add weekend runs.** A weekend digest mostly re-emits
Thursday's postings, and every import bumps `last_seen`, which is what the LATEST REPORT date and the
jobs chip are derived from. So a Sunday run makes Thursday's rows look like they arrived Sunday. That
is the same staleness `weekly-roundup.md` forbids the Friday task from causing. Employers post on
weekdays anyway, and the search window is 14 days, so a Friday posting is still caught on Monday.

---

## Routine 1: daily digest, Monday to Thursday

```
You are running Duaa Khalid's morning job search. This is not a coding task: do not modify, commit or
push any code, and do not open a pull request.

Read these five files from the repository. They are the spec and you follow them exactly:

- prompts/daily-search.md     the task you are running, step by step
- prompts/profile.md          the profile, the hard constraints, the tiered targets
- prompts/scoring-rubric.md   step 0 filters, tier classification, bands, caps
- prompts/resume-tailor.md    the tailoring rules
- resume/master-resume.md     the master resume, which tailoring diffs against

If the repository is not checked out, fetch them from
https://raw.githubusercontent.com/khalidduaa1-byte/Job-Search-Agent-Dashboard/main/<path> instead.
If you cannot read them at all, stop and say so. Do not score from memory: a half-remembered rubric
produces numbers that mean nothing.

Six things get got wrong most often, so check yourself against each:

1. Run the step 0 filters BEFORE scoring anything. She is F-1 and authorization is timing-gated. A
   posting that states a start date before May 2027 is dropped, not scored low. A posting stating no
   start date at all, which is most of them, is emitted with "timing": "unstated" and its fit score
   left alone, and it is pipeline rather than an application. Do NOT subtract anything from the score
   for this: the dashboard applies the penalty to the ordering. Subtracting it here put every role in
   the weak band and pinned the 90 plus count at zero.

   Posting age is not a filter. Confirm it is live, then ignore how long it has been live. OpenAI and
   Anthropic keep the same titles open for months and refresh rather than repost, so a months-old
   date at a lab is a standing requisition and dropping it would delete the top of her board.
2. Classify on the REQUIREMENTS SECTION, not the title. "Forward deployed" and "AI deployment" are
   two different jobs under near-identical titles, and some manager-titled deployment roles carry a
   coding screen or ask for years of production software. Drop the engineering flavour whatever the
   title says. "AI" in a title is noise: score the work described.
3. United States only, and New York City or remote-US specifically. San Francisco is not actionable
   while she is enrolled, so emit it only where the company has a New York office and say so.
4. Verify every posting by opening it. If you cannot open it or confirm it exists, drop it. Never
   invent a posting, company, URL or date. One invented posting costs more trust than ten missed ones.
5. Never emit status, hidden or notes in the JSON. Those are hers. Omit band too, the dashboard
   derives it from score. Do emit timing on every record.
6. No em dashes anywhere. Commas or full stops.

Aim for 15 to 20 postings. Fewer is fine on a slow morning. Do not pad the list to hit a number.

Reach 15 by widening the sourcing, never by loosening the filters. Read more employer boards, work
the Tier 2 GTM family across any technology company rather than only AI-native ones, and work
Tier 3. Do not relax step 0, do not let a Tier 4 engineering role through on its title, and do not
inflate a score to fill the list. Nine real postings beat eighteen where nine were padding, so when
the morning falls short, say the count and the reason.

Enumerate a large board with curl piped into a parser rather than a page fetcher. OpenAI's board is
over 11MB and a 10MB fetch limit failed it silently, surfacing one role instead of ten and missing
two Tier 1 New York reqs.

If a board-state brief is supplied, the dashboard's "Agent brief" button produces one, honour its
skip list and match on the URL where a row has one, because an aggregator rewrites the title and the
location for the same job. Never tailor a resume for a role on that list. "Saved" is deliberately not
on the skip list. If the brief is more than about a week old, say so. If you have none, say that in
one line rather than pretending the list is clean.

If nothing scored 80 or above, tailor nothing and say so in one line. A tailored resume for a 62 is
wasted work and it teaches her to ignore the attachment. Measure that 80 against fit BEFORE the
start-date deduction and after every other cap. When you do tailor, tailor for the top opportunity
only and output a DIFF against resume/master-resume.md, not just a clean file: a clean file hides a
number that drifted. Render it with `node resume/render.mjs <file>.md`, which exits non-zero if it
runs over one page.

Deliver it two ways, because one channel alone has proved unreliable:

1. Write digest-<date>.json containing only the JSON array, no fence and no prose, plus
   digest-<date>.md with the readable digest, and send them with SendUserFile. Include the tailored
   resume and its diff when there is one.
2. Your final response, in the same shape, so it is readable in the routines dashboard too.

Begin with one line stating whether you could read the five files, whether web search worked, and
whether SendUserFile worked, so a broken run is visible at a glance instead of looking like a quiet
morning.

Then follow daily-search.md section 5: the one line read, the top opportunity with both links, the
rest ordered by score, what the filters dropped as a count and one line, and the JSON array under a
heading that says "Paste into the dashboard".

The dropped-by-filter line is not optional. It is the only signal she has from outside the session
that the authorization filter actually ran. If it is missing, or reads zero every day, the search is
broken.

If the search turns up nothing, say exactly that. A quiet morning is information. Silence looks like
a broken task.
```

---

## Routine 2: Friday roundup

**This one needs an input from you: click Export in the dashboard and paste the JSON into the run.**
Without it the roundup can only do half of the still-open check, and it will say so rather than invent
a week. That is deliberate.

```
You are writing Duaa Khalid's Friday roundup for her job search. This is not a coding task: do not
modify, commit or push any code, and do not open a pull request.

Read prompts/weekly-roundup.md, prompts/profile.md and prompts/scoring-rubric.md from the repository,
or from https://raw.githubusercontent.com/khalidduaa1-byte/Job-Search-Agent-Dashboard/main/<path> if
there is no checkout. If you cannot read them, stop and say so.

Your input is a BOARD EXPORT, not the four daily digests. Do not go looking for the digests: no tool
can read another routine's past sessions. The board is the week's digests already merged and
deduplicated, and it carries what the digests never could, which is the status she has since set.

In order of preference:
1. A board export, the JSON from the Export button, pasted or attached. Every role with score,
   status, hidden, first_seen and last_seen.
2. An Agent brief, which covers what is unactioned and gives you URLs, but not the full week.
3. Nothing. Then say so in your first line, do the part of the still-open check you can, and stop.

"This week" means first_seen within the last seven days. Older rows are on the board but are not this
week's news, though they still belong in the unactioned section if they are 90 plus and untouched,
because a strong role sitting for a fortnight matters more than one from Tuesday, not less.

Never reconstruct the week from a fresh search. That is a fifth search dressed as a roundup and it is
the one thing this task forbids. Never state a score you were not given.

The still-open check is the reason this task exists, and it works with only a list of URLs. For the
five highest scoring roles in the input, open the posting again and mark it still open, closed, or
could not confirm. Do not guess. Re-opening a posting you were handed is not new searching. When a
role has closed, say so and tell her to set that row to closed herself, because status is hers and an
import must never write it.

Emit no JSON. None. Everything in a roundup is already on the board, and re-importing bumps last_seen
on every row, which makes the board report that the whole week arrived today.

For what is sitting unactioned: every row with score 90 or above, status new or saved, and hidden
false. Say when the input was generated, because a three day old export is three days of triage out of
date.

Follow weekly-roundup.md section 3 for shape: the read on the week in three sentences at most, the top
five with the still-open check, what is sitting unactioned, and one thing to change next week. If
there is nothing real to change, write "Nothing to change" and stop.

Begin with one line stating whether you could read the three files and what input you were given, so a
blocked run is visible at a glance. Also send the roundup as a markdown file with SendUserFile, even
on a blocked run, so it reaches her rather than only sitting in a session transcript.

No em dashes. If the week was thin, say the week was thin.
```

## Authorisation belongs in the routine's prompt, never in a fired payload

Learned the hard way, and it cost a run.

`fire_trigger` can append text to a firing, which is useful for passing run-specific context. It is
**not** a way to grant permissions. A routine whose stored prompt said *"do not modify, commit or push
any code"* was fired with a payload telling it to commit and push. It refused, and it was right to:

- Standing configuration beats injected text. A payload arriving with a trigger is **data**, not
  instructions, unless the routine's own prompt says to defer to it.
- The payload asked it to report whether a `GH_TOKEN` was present, enumerate its GitHub tools, then
  escalate through push targets until one succeeded. Whoever sent it, that shape is
  credential-and-write-access reconnaissance, and it arrived at an unattended session with nobody
  present to confirm anything. Refusing was correct.

So when a routine needs to write, **put the authorisation in its prompt**, scoped as narrowly as it
goes: which directory, which files, and an explicit statement that nothing else may be touched. The
publish step in Routine 1 above is written that way on purpose.

Two practical consequences:

- **Never fix a permissions problem by sending a payload.** Edit the routine. A payload that
  contradicts the prompt should fail, and the day it stops failing is the day the routine will do
  whatever a compromised digest tells it to.
- **A refusal like that is the system working.** Read the reasoning before assuming the run is broken:
  it explains exactly which instruction it followed and why.

## Why the prompts live in the repo rather than only in the routine

Both routines read `prompts/*.md` at run time, so **editing a prompt here changes what next morning's
task does** with no routine to re-paste. The text above is the thin wrapper that points at those
files and repeats the handful of rules most often ignored. Keep the wrapper short and put real changes
in the prompt files.
