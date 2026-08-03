# Weekly roundup, Friday

Paste this into a **Claude scheduled task** set to run Friday morning. Attach `profile.md` and
`scoring-rubric.md`.

The roundup is not another search. It is the weekly read on what the week actually turned up,
and the one message that should make her change what she does next week.

---

You are writing Duaa Khalid's Friday roundup for her job search.

## 1. Gather the week

Pull the four daily digests you sent Monday through Thursday. If a day is missing, say which
day and move on rather than reconstructing it from a fresh search.

## 2. Re-check the top of the pile

For the five highest-scoring roles of the week, open the posting again and confirm it is still
live. A role that closed inside the week is worth knowing about, and it is the single most
useful thing this task does that the daily digests cannot.

Mark each as still open, closed, or could not confirm. Do not guess.

## 3. Write the email

Subject: `Weekly roundup, week of <D Month>, <N> roles, <M> at 90 plus`

Body:

1. **The read on the week**, three sentences at most. Not a summary of the list. What changed:
   a title pattern that keeps appearing, a company that posted three adjacent roles, a band
   that came up empty. If the week was thin, say the week was thin.
2. **Top five**, with the still-open check. `<score> · <Role> · <Company> · <Location> · still
   open / closed / unconfirmed` and the link.
3. **What is sitting unactioned.** Anything that scored 90 plus this week that she has not applied
   to. This is the part with a deadline attached, so keep it short and specific.

   **This section requires the Agent brief** from the dashboard, whose second half is exactly this
   list. Applied state lives in her browser under `jsd.board.v1` and there is no server, so **you
   cannot work it out.** With the brief, use its 90-plus section and say when it was generated.
   Without it, write one line: `No board state supplied, so I cannot tell which of the week's 90 plus
   you have actioned. The dashboard's Agent brief button produces it.` Then list the week's 90 plus
   and stop.

   Do not infer it from the digests. A model guessing here is wrong every Friday in the section that
   is supposed to carry a deadline, which trains her to skip it.
4. **One thing to change next week**, and only if you have a real one. A search that is not
   returning anything, a title worth adding to the watchlist, a company worth tracking
   directly. If there is nothing, write `Nothing to change` and stop. An invented suggestion
   every Friday trains her to skip the section.

## 4. No JSON

The roundup emits **no JSON block**. Everything in it was already imported during the week, and
re-importing it would bump `last_seen` on every row, which would make the whole board look like
it arrived today and destroy the "latest report" view in the dashboard.

The one exception: if step 2 found a role that closed, mention it in the prose. She can set that
row to `closed` herself, because status is hers to set and an import must never write it.

## Hard rules

- **No new searching.** This is a read on the week, not a fifth digest.
- **No invented postings or metrics.** Only what the week's digests contain and what you
  re-confirmed.
- **No em dashes.**
- Do not claim a role is still open unless you opened it today.
