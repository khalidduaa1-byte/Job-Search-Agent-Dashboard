# Weekly roundup, Friday

Paste this into a **Claude scheduled task** set to run Friday morning. Attach `profile.md` and
`scoring-rubric.md`.

**It needs one input from her: a board export.** Click **Export** in the dashboard and paste or attach
the JSON into the run. Without it this task can only do half of section 2 and none of sections 1 and
3, and it will say so rather than invent them. See step 1.

The roundup is not another search. It is the weekly read on what the week actually turned up,
and the one message that should make her change what she does next week.

---

You are writing Duaa Khalid's Friday roundup for her job search.

## 1. Gather the week, from the board export

**The input is a board export, not the four digests.** Click **Export** in the dashboard and paste or
attach the JSON. That is one action, and it gives you strictly more than the digests do: every role
the week produced, with its score, its `first_seen`, its `last_seen`, and the status she has since
set. The digests cannot tell you the last of those, and the last one is what section 3 is about.

An earlier version of this file said "pull the four daily digests you sent". **Nothing can do that.**
There is no tool that reads another routine's past sessions, and a scheduled task has no memory of
what a different scheduled task emitted. That instruction sat here for a while and every Friday run
correctly refused to satisfy it, which is the right failure but a wasted run. The board is the
week's accumulated digests, already merged and deduplicated, so read the board instead.

The **Agent brief** is a usable second best if she has that to hand rather than a full export: it
carries the skip list and the unactioned 90 plus roles with their URLs, which covers section 3 but not
the week's full set.

**"This week" means `first_seen` within the last seven days.** Older rows are still on the board and
are not this week's news, so leave them out of the read on the week. They can still appear in section
3 if they are 90 plus and unactioned, because a strong role sitting untouched for a fortnight is more
worth flagging than one from Tuesday, not less.

If you were given nothing, say so in one line, do the part of section 2 you can, and stop. Do not
reconstruct the week from a fresh search: that is a fifth search wearing a roundup's clothes, and it
is forbidden below for a reason.

## 2. Re-check the top of the pile

For the five highest-scoring roles of the week, open the posting again and confirm it is still
live. A role that closed inside the week is worth knowing about, and it is the single most
useful thing this task does that the daily digests cannot.

Mark each as still open, closed, or could not confirm. Do not guess.

**Re-opening a posting you were handed is not "new searching"**, so the hard rule below does not
forbid it. This is the one part of the task that works with no input beyond a list of URLs, so if the
export is missing but she pasted anything with links in it, do this much and say that is all you could
do.

When a role has closed, say so in the prose and **tell her to set that row to `closed` herself**.
Status is hers and an import must never write it, so a hand edit on the board is the only way that
state gets recorded.

## 3. Write the roundup

Send it if an email tool is available. If not, your final response is the roundup and she reads it in
the routines dashboard. The shape is the same either way.

Subject, or the first line: `Weekly roundup, week of <D Month>, <N> roles, <M> at 90 plus`

Body:

1. **The read on the week**, three sentences at most. Not a summary of the list. What changed:
   a title pattern that keeps appearing, a company that posted three adjacent roles, a band
   that came up empty. If the week was thin, say the week was thin.
2. **Top five**, with the still-open check. `<score> · <Role> · <Company> · <Location> · still
   open / closed / unconfirmed` and the link.
3. **What is sitting unactioned.** Anything that scored 90 plus this week that she has not applied
   to. This is the part with a deadline attached, so keep it short and specific.

   **This comes straight from the board export or the Agent brief**, both of which carry status.
   Applied state lives in her browser under `jsd.board.v1` and there is no server, so **you cannot
   work it out** from anything else. With the export, list every row where `score >= 90` and `status`
   is `new` or `saved` and `hidden` is false. With the brief, use its 90-plus section. Say when the
   input was generated, because a three-day-old export is three days of triage out of date.

   Without either, write one line: `No board state supplied, so I cannot tell which of the week's 90
   plus you have actioned. Export the board, or click Agent brief, and paste it in.` Then stop.

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
