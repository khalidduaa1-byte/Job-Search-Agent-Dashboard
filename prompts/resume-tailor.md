# Tailoring the resume

Called by `daily-search.md` for the single highest-scoring posting of the morning, and only when
it scored 80 or above.

Read `profile.md` first. The master resume is `resume/master-resume.md`, and it is the fixed
input. That is the whole point: tailoring is a **diff against one document**, not a fresh write. A
resume rewritten from scratch every morning drifts, and by week three the claims no longer match
each other or the master.

`resume/Duaa-Khalid-resume-CSM.pdf` is the layout reference, not the content source. See
`resume/README.md`.

---

You are tailoring Duaa Khalid's master resume for one specific posting.

## What you may change

- **Ordering.** Move the most relevant role or project up. This is the highest-value edit and
  usually the only one needed.
- **Bullet selection.** Keep the bullets that speak to the posting, drop the ones that do not.
  Dropping is allowed. Rewriting is mostly not.
- **Emphasis inside a bullet.** Lead with the part the posting cares about. The same tracker
  bullet leads with the dedup pipeline for a data role and with the 18-advisor rollout for a
  deployment role. Same facts, different first clause.
- **Vocabulary, only where it is genuinely the same thing.** If the posting says "time to
  value" and the master says "cut ordering time from 45 minutes to 5", using their phrase for
  her result is fair. Using their phrase for something she did not do is not.

Since there is no summary section, **ordering and bullet selection are where the tailoring lives.**
That is the whole edit, and it should be visible in the diff without a single sentence being
rewritten.

## The structure. Do not change it

1. **Contact line**, reading `New York, NY`.
2. **No summary section.** There is deliberately none. Do not add one back, however much a posting
   invites a positioning statement.
3. **Projects first.** Reviewers read the top third and stop, so the shipped work goes above the
   account management. The Beauty Advisor Sales Tracker leads.
4. **Experience.**
5. **Education**, with the MSc labelled part-time.
6. **Skills.**

Reordering *within* Projects and *within* Experience is the tailoring. Moving Experience above
Projects is not, and neither is reintroducing a summary.

## What you must not change

- **Every number stays exactly as written in `profile.md` and the master resume.** 48% net revenue
  and 44% sell-through, FY2025 against FY2024. Plus 26% 2026 year to date. Roughly $2.5M book of
  business. 13 markets. 45 minutes to 5, roughly 89%. 30 plus MENA locations. A 30 plus person field
  team. 18 advisors across 3 Egyptian markets. Roughly 20 field users. 1,324 rows, 0 rejected, 29
  duplicates. Six Firestore collections. 20 of 31 items, AED 8,400 against AED 10,688. CGPA 3.95 out
  of 4.0. Do not round, do not convert, do not recompute, do not upgrade a number because the
  posting mentions scale.
- **"29 duplicates removed" is not "29 rows rejected".** The rejection count is 0. These are
  different numbers describing different things and the distinction is the kind that gets tested in
  a screen. Precision of language matters more than impressiveness here: a claim that unravels under
  questioning is worse than a weaker claim that holds.
- **The LVMH tool's scope, if you state it at all.** Two direct users, her and one colleague; the
  ordering process it served covered 30 plus MENA locations; the 45 to 5 minutes is per order. Say
  those together or say the metric alone. Never imply 30 plus people used the tool.
- **One derived figure is allowed**, the 78.6% recovery rate, because it is AED 8,400 over AED
  10,688 and nothing else. Write it as 78.6% or not at all. No other percentage, ratio, average
  or annualised figure may be computed from the numbers above, however defensible the arithmetic
  looks, because a figure that is not in `profile.md` cannot be checked against anything.
- **Job titles exactly as held, with no embellishment.** "Customer Success and Key Account
  Manager". No invented prefixes: **not** "Internal product owner", because the record does not say
  that. Do not retitle a role to match a posting. If a posting wants a title she did not hold, that
  is a gap, not a formatting problem.
- **Dates and employers.** Never adjusted.
- **Homebase is a hackathon build, and only the CRUD app shipped.** Six Firestore collections, the
  product scope and the data model. The RERA, WhatsApp and AI-agent layer was **vision, explicitly
  out of MVP scope**: never call it live, never call it a product, never attach a production metric
  to it, and never cite its README's unsourced stats. What is worth writing is the design decision,
  a deterministic template as the default with the model path behind an opt-in flag.
- **No link to `github.com/bm2515/homebase`.** It is the co-founder's private repo and it 404s
  for every visitor. The live link is `homebase-labs.lovable.app`.
- **No new skills, tools, certifications or languages.** If it is not in `profile.md`, it does
  not go on the resume, however well it would match.
- **No placeholder KPIs.** If a number is not known, **cut the bullet**. Never write a bracketed
  blank, a "TBD", or a plausible-looking figure to hold the shape of a sentence.
- **The contact line reads `New York, NY`.** Never `Dubai, UAE`. Every posting in this pipeline is
  a US role, and a Dubai header is the first thing a US recruiter reads. The per-role locations
  stay `Dubai, UAE`, because that is where those jobs were. Leave the phone number exactly as it
  is: a UAE mobile is honest, and inventing a US number is not.
- **Never describe her experience as go-to-market.** GTM is a target, not a role she has held.
  For a GTM posting, lead with the account portfolio, the renewals and QBRs, the 48% net revenue
  growth and the field enablement, and call those what they are. Do not relabel account
  management as GTM, do not add a "GTM" skills line, and do not imply pipeline generation,
  partner strategy, pricing or new-business quota ownership.

## Handling a gap

When the posting requires something she does not have, the answer is ordering and honesty, not
invention.

- Lead with the nearest real thing. For "shipped ML to production", the nearest real thing is the
  ingest pipeline and the dedup rules, described as exactly that. Do not reach for Homebase's agent
  work here: that layer did not ship.
- **For a hard PM-title requirement, do not invent product framing.** She has no PM title on record
  and the screen is the obstacle. Lead with the product ownership she did have, the sell-in decision
  support tool and the tracker, under the titles she actually held.
- Do not add a "familiar with" line to cover a gap. It reads as a gap with a label on it, and
  it will be asked about in the screen.
- If more than about a third of the requirements are gaps, say so in the email note rather than
  stretching the document. That is a signal the score was too high, and it should feed back into
  the rubric.

## Output

1. **A diff against `resume/master-resume.md`**, not just a clean file. Unified diff, or an explicit
   list of every line moved, kept, dropped and reworded. **This is the required output**, and the
   clean document is secondary to it.

   The reason is specific. A tailoring pass left unreviewed will eventually round "29 duplicates
   removed" up to something punchier, or quietly promote Homebase's vision layer into something that
   shipped. Those are exactly the claims she has been questioned hard on. A clean file hides that
   edit; a diff cannot. If the diff shows a number changed, that is a bug in the tailoring, not a
   judgment call.

2. **The tailored resume**, as a document attached to the morning email. Same layout as the master.
   One page.

3. **A one-line note for the email**, stating what you actually changed. `Led with the tracker
   rollout and the 18-advisor adoption, moved the D and G portfolio bullet above the QBR one,
   dropped the move-out project.`

That note is the audit trail. If it ever reads `tailored the resume for this role`, the
tailoring did not happen and the note is covering for it. If the diff is empty, say that instead of
attaching an identical file and calling it tailored.

## Hard rules

- **No em dashes.**
- Contact is `dk947@cornell.edu`, including in link text. Check case-insensitively: an all-caps
  gmail address survived a case-sensitive find and replace once.
- Never invent a metric, a title, a date, or a tool.
- If you cannot honestly tailor for this posting, say so in one line and attach nothing.
