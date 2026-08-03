# The scoring rubric

A score is a claim about fit. It has to mean the same thing on Monday as it does on Thursday,
or the ordering in the dashboard is noise and the 90-plus count on the stat row is meaningless.

Read `profile.md` first. Score against what is actually in it.

## Step 0. Run the filters before you score anything

The hard constraints in `profile.md` are **filters, not penalties**, and they run first. A role she
cannot legally start is not a low score, it is not a record at all. Scoring first and filtering
after produces a digest full of great-fit roles that are not actionable, which is the exact failure
this pipeline exists to prevent.

Drop the posting entirely, before scoring, when any of these is true:

1. **Not a United States role.** See the rule below.
2. **The posting states a start date before May 2027 for a full-time role, or before summer 2027
   for an internship.** She is F-1 and the clean CPT window is summer 2027, after one full academic
   year. Summer 2026 and Fall 2026 starts are impossible. A start date that has already passed is
   the same drop.
3. **It requires US citizenship or permanent residency**, or it explicitly excludes student visas,
   CPT or OPT. This is narrower than it looks, so read the next section before applying it.
4. **It is a Tier 4 role** in `profile.md`: GTM Engineer at a lab, Forward Deployed or Applied AI
   Engineer where the bar is a real software engineering bar, SWE, MLE.
5. **It is on-site outside New York**, including San Francisco, **at a company with no New York
   office.** She cannot relocate to a third city mid-programme, so there is no version of this she
   can take. Where the company does have a New York office, emit it with the constraint named: it is
   a relationship, not an application.
6. **It was posted or last reposted more than 14 days ago**, or **you could not open it and confirm
   it exists.**

### The start date, which is the hard case

Most postings state no start date at all, and a full-time req with no stated date means **an
immediate start**. Read literally against constraint 2 that would drop almost every full-time role
in the market, which is useless. Read loosely it lets everything through, which defeats the filter.
Neither is right, so:

- **Full-time, no stated start date: emit it, and cap it at 70.** Presume an immediate start, because
  that is what it means. The cap keeps it visible without ever letting it become the top opportunity
  of the day or earn a tailored resume, and the rationale must say `start date unstated, presume
  immediate, so this is pipeline rather than an application`.
- **Full-time, stated start in or after May 2027**, or aimed at 2027 graduates, or explicitly
  flexible on start: **fully actionable, no cap.** These are the roles the search exists to find,
  and they are what should reach the strong band.
- **Internship or co-op, summer 2027: fully actionable.** Earlier: drop.
- **Part-time or contract during term:** actionable only at **15 to 20 hours per week or fewer**, and
  it needs ISSO signoff, so say so in the rationale. Above 20 hours a week during term, **drop**:
  constraint 3 in `profile.md` makes it a conflict she cannot resolve.

The point of the cap rather than a drop is that the daily top pick and the tailored resume go to a
role she can actually start. A presumed-immediate-start role is worth knowing about and worth a
conversation. It is not worth her morning at the top of the list.

### Work authorization, precisely

Three different sentences get confused here, and they have three different answers.

- "Must be authorised to work in the United States" or "must be authorised without sponsorship":
  **not a drop and not a cap.** F-1 CPT and OPT are work authorisation, and they need no employer
  sponsorship. Do not read this as excluding her.
- "We do not and will not sponsor visas", or any statement ruling out future sponsorship: **cap at
  40** and say so in the rationale. She will need H-1B or equivalent eventually, so this is a real
  ceiling on the role rather than a paperwork detail.
- "Must be a US citizen", "requires permanent residency", "we cannot accept candidates on student
  visas, CPT or OPT": **drop at step 0.** Nothing she can do changes it.

Do not guess. If the posting is silent on sponsorship, do not raise the subject at all.

## Step 0b. Classify on the requirements, not the title

Do this before you pick a role-core band, because it decides which band applies.

**"Forward deployed" and "AI deployment" are two different jobs under nearly identical titles.**
The GTM and adoption version is her best target. The engineering version has a real SWE bar. Titles
are used loosely and **some manager-titled deployment roles smuggle in a coding screen**, so read
the requirements section and classify on that.

- Requirements are enterprise customers, adoption, onboarding, post-sales ownership, programme
  delivery, change management: **this is Tier 1.** Score it as such.
- Requirements are a coding screen, a take-home engineering assessment, or system design: **this is
  Tier 4.** Drop it, whatever the title says.

Most engineering postings never describe their interview loop, so **do not rely on the loop being
mentioned.** Any one of these in the requirements makes it Tier 4 on its own:

- Years of **professional software engineering** or production-code experience.
- **Shipping or owning production code**, services, pipelines or infrastructure as the main output.
- A named engineering stack as a requirement rather than as context: Kubernetes, distributed
  systems, Go, Rust, C++, CUDA, model training or fine-tuning.
- A computer science degree required.
- The role reports into engineering and its deliverable is software.

A deployment or forward-deployed posting that asks for "5 plus years building production software"
and says nothing about interviews is **Tier 4**, and it is the case most likely to be scored wrong.

**"AI" in a title is noise** and carries close to no signal. Score on the work described.

### "AI platform", defined once

The phrase decides real points below, so it needs a definition rather than a vibe. An **AI platform**
is a company whose **primary product** is a model, or the tooling to build, deploy, evaluate or serve
models. A model lab counts. An observability, eval, vector or orchestration tool counts.

A company whose primary product is something else, with a model inside it or an AI copilot attached,
**does not count**, however much the posting says AI. That company is an "other technology company",
which is a perfectly good 8 on company shape.

When it is genuinely borderline, treat it as an other technology company and say so in the rationale.
Company type is scored **once**, on the company shape axis, and never again on role core.

## The bands

| Band | Score | What it means |
| --- | --- | --- |
| `strong` | 90 to 100 | Apply this week. The core of the job is work she has done, and nothing in the requirements is disqualifying |
| `possible` | 70 to 89 | Worth reading properly. Real overlap, with one clear gap or a compromise on level, scope or geography |
| `weak` | below 70 | Logged so the low band is visible rather than silently dropped. Not worth her morning |

The dashboard derives the band from the score, so **do not try to make them disagree**. If a
posting feels like a 95 but you can only justify 80, the score is 80.

## How to build a score

Start at zero and add. Then apply the caps, which are not optional.

**Role core, up to 45.** How much of the day-to-day is work in `profile.md`? Use the tier you
assigned in step 0b, from the requirements rather than the title.

Judge the **work**, not the company. Company type is scored once, on company shape.

- 45: **Tier 1.** Owns deployment or adoption of a technical product inside a customer's operation,
  the GTM and adoption flavour
- 43: **Tier 1.** Technical account management or enterprise customer success: owning a book of
  enterprise accounts through onboarding, adoption, renewals and expansion. Just below deployment on
  ceiling, not on fit. **Highest offer probability on the list and the fastest yes**
- 40: **Tier 1.** Solutions consulting or pre-sales, the discovery-and-scoping flavour
- 30: post-sales, enablement or solutions work that is not account-owning, or product ownership of an
  internal decision or data tool. **This is her old job, not a target**, so it does not carry a tier
- 26: **Tier 2.** Go-to-market strategy and operations, RevOps, product marketing, partnerships or
  business development. Below post-sales on purpose. **She has not held a GTM role**, so this band is
  adjacency, not experience: the account portfolio, renewals, QBRs and expansion work is the nearest
  real thing and the GTM function itself is a gap. Name the gap in the rationale
- 20: **Tier 3.** Growth PM, AI PM, product analyst, BI, data science. Viable, but she is competing on
  the same axis as everyone else. Growth PM sits at the top of this band, above generic AI PM
- 16: adjacent commercial or programme work, including a GTM role outside technology
- 10: analyst work executing against someone else's spec

**Domain and system fit, up to 20.** Does the posting describe the specific problem she is good at?

Six signals count. Score by **how many the posting states**, not how many you can infer:

1. Enterprise or strategic account ownership.
2. Adoption, onboarding or enablement as an outcome the role owns.
3. Change management with **non-technical end users**, especially in a field organisation.
4. Unreliable operational input, data quality, or defining what a valid record is.
5. Translating loosely-defined technical goals into a delivered programme.
6. Exec and leadership stakeholder exposure.

| Signals the posting states | Points |
| --- | --- |
| 5 or 6 | 20 |
| 4 | 16 |
| 3 | 12 |
| 2 | 8 |
| 1 | 4 |
| none stated, only inferable | 0 |

**Count only what the posting says.** If you are arguing that a signal is implied, it is not stated
and it scores nothing. This axis was unanchored prose once and the same posting could move 6 points
on the reader's mood, which is enough to cross a band boundary on its own.

**Do not count a signal here that already earned the role-core band.** If the role core is 43 for
owning a book of accounts, signal 1 is already paid for: do not count it twice. The two axes measure
different things, the job shape and the problem shape, and double-counting the overlap is what let
Tier 1 postings clear 90 too easily.

**Geography and timing, up to 15.** She is in New York from mid-August 2026 and the MEng runs to
May 2027, so location is about what she can actually take.

- 15: New York City, or genuinely remote-US
- 8: another US metro, **including San Francisco**, where the company has a New York office. Not
  actionable itself, worth a relationship. Say so in the rationale
- 0: on-site anywhere else in the US. Step 0 filter 5 drops these when there is no New York office,
  so a 0 here should be rare

**A non-actionable location caps the record at 75**, so a role she cannot take never outranks one she
can. Without that cap an on-site San Francisco role reached 89 and sorted above an actionable
remote-US role at 79, which is exactly backwards.

**When the header and the body disagree about location, score the body and flag it.** The body is
where the requirement lives; a header is often a template field. This case is common enough to need a
rule, since it otherwise moves geography by 15 points on a coin flip.

Roles outside the US score nothing here, and are excluded entirely by the filter in step 0.

**Company shape, up to 12.** Judge the company, not whether the word AI appears. Use the definition
of "AI platform" above.

- 12: a model lab, AI platform or tooling company, or an AI-native startup or scaleup
- 8: any other technology company, including one with a model inside a product that is not itself the
  platform. For a Tier 2 GTM role this is usually the right band
- 4: a traditional company with an AI initiative
- 0: no technology dimension at all

Add **2 within the band, to a maximum of 12**, for a company that **hires just-in-time** rather than
on a campus cycle, because that matches her timeline where a structured new-grad pipeline does not.

**Evidence the search is live, up to 8.**

- 8: on the employer's own board, posted or reposted in the last 14 days
- 5: on the employer's own board, no date given
- 3: an aggregator listing you opened and confirmed against the employer's site
- 0: an aggregator listing you could confirm no further

Anything you could not open at all was dropped at step 0, so there is no band for it here. This axis
used to describe an unreachable value and was therefore a constant 8 on every surviving record, which
made it decoration rather than a signal.

## The caps. These override everything above.

A cap is only worth writing if it can actually bite. Check it against the band ceilings below: a cap
set above a role's ceiling does nothing, and two of these used to be in exactly that position.

- **Requires an ML model shipped to production, or engineering management: cap at 65.** She has
  not done either, and a 90 here wastes her week.
- **A hard "3 plus years as a Product Manager" screen: cap at 60**, and **name the screen risk in the
  rationale**. She has no PM title on record. Deprioritise, do not auto-reject: the useful information
  is that she loses at the screen rather than in the loop, and that is exactly why the deployment and
  solutions organisations in Tier 1 are Tier 1, because they screen differently. **5 plus years of
  product management: cap at 50.** These were 70 and 55, above the Tier 3 ceiling of 72, so they never
  fired.
- **A go-to-market role that requires GTM or sales leadership experience she does not have: cap at
  55.** Owning pipeline generation, partner or channel strategy, pricing and packaging, or a
  new-business quota is not on her record. This was 75, above the Tier 2 ceiling of 78, so it never
  fired either.
- **A non-actionable location: cap at 75.** On-site outside New York at a company that does have a
  New York office. It is a relationship, not an application, and it must not outrank a role she can
  take.
- **Full-time with no stated start date: cap at 70.** Presumed immediate start. See the start-date
  section above. This is the most frequently applied cap in the whole rubric, because most postings
  state no date.
- **Requires 8 or more years in the exact function: cap at 65.**
- **Rules out future visa sponsorship: cap at 40**, and say so in the rationale. Read the work
  authorisation section above first: "must be authorised to work in the US" is **not** this.
- **Requires a security clearance: cap at 20.**
- **The posting has internal inconsistencies: no cap, but flag it in the rationale.** Obvious typos,
  applications handled off-platform, a header and body that disagree. For a Series A company this is
  not disqualifying, but she should confirm the real funnel before spending effort on it, and she can
  only do that if the digest tells her. For a location mismatch specifically, score the body.

**When two caps apply, the lowest wins.**

### What each band can actually reach

Domain and system fit is rarely full marks, so these are ceilings rather than expectations. They are
here so you can see whether a cap bites, and so the tier order in `profile.md` is visible in the
arithmetic rather than only asserted.

| Role core | Ceiling | Highest band reachable |
| --- | --- | --- |
| 45, Tier 1 deployment | 100 | strong |
| 43, Tier 1 TAM or enterprise CSM | 98 | strong |
| 40, Tier 1 solutions | 95 | strong |
| 30, post-sales or internal product, no tier | 85 | possible |
| 26, Tier 2 GTM | 81 | possible |
| 20, Tier 3 product and analyst | 75 | possible |
| 16, adjacent commercial | 71 | possible |
| 10, analyst against a spec | 65 | weak |

Tier 2 and Tier 3 are 6 points apart at the ceiling, so the ranking holds. They were 4 points apart on
role core and 4 the other way on company shape, which cancelled exactly and tied an AI PM at a lab
with a RevOps role at an AI company.

**A Tier 2 GTM posting cannot reach the strong band, and that is correct.** She has not held a GTM
role. Do not read the GTM cap as a path to 90: the ceiling is 81 and the cap only exists for postings
that additionally demand GTM leadership.

The step 0 filters are not caps and are not repeated here. A non-US role, a stated start date before
May 2027, a citizenship or permanent-residency requirement, a Tier 4 role, an on-site role in a city
with no company presence she can reach, a posting older than 14 days and a posting you could not open
are all **dropped**, not scored low. A hallucinated opportunity is worse than a missed one, because it
costs her a morning and teaches her not to trust the board.

## The rationale field

One sentence. It has to survive being read three weeks later by someone deciding whether to
still apply.

- Name the specific overlap, not the category. "Owns adoption for an enterprise AI platform,
  which is the tracker rollout with a bigger customer" beats "great fit for her background".
- **Name the gap in the same sentence** when the score is below 90. The gap is the useful part.
- **Say which tier you classified it as, and on what**, whenever the title is ambiguous. "Titled
  deployment manager, requirements are adoption and enablement with no coding screen, so Tier 1"
  is the most useful thing the rationale can carry, because it is the judgment she cannot make from
  the title alone.
- Flag the three things she has to act on: a **PM-title screen**, a **start date** that is
  unconfirmed or awkward, and an **inconsistent posting**.
- No adjectives about her. No "exciting opportunity". No pitch.

Good: `Post-sales adoption ownership for an AI platform, closest match to the deployment track,
but the posting asks for five years of enterprise SaaS she does not have.`

Good: `Titled forward deployed engineer but the requirements are customer scoping and enablement
with no coding screen, so this is the adoption flavour, and the start date is unconfirmed.`

Bad: `Excellent alignment with Duaa's impressive background in AI and product.`

## Calibration check

Before emitting a digest, look at the set. If more than about a third of what you found is
`strong`, you have drifted, and the fix is to re-read the caps rather than to shuffle scores.
A normal morning is one or two strong, a handful of possible, and some weak.

Where a posting is genuinely borderline, score it lower and say why in the rationale. The cost
of a missed 88 is that she reads it on Friday in the roundup. The cost of an inflated 94 is
that she stops believing the number.
