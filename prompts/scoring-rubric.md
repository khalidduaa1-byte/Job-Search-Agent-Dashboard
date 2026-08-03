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
2. **The start date is before May 2027 for a full-time role, or before summer 2027 for an
   internship.** She is F-1 and the clean CPT window is summer 2027, after one full academic year.
   Summer 2026 and Fall 2026 starts are impossible.
3. **It requires existing US work authorization with no CPT or OPT accommodation.**
4. **It is a Tier 4 role** in `profile.md`: GTM Engineer at a lab, Forward Deployed or Applied AI
   Engineer where the bar is a real software engineering bar, SWE, MLE.
5. **You could not open the posting or confirm it exists.**

When the posting does not state a start date, do not invent one. Treat it as open and score it,
then say in the rationale that the start date is unconfirmed.

## Step 0b. Classify on the requirements, not the title

Do this before you pick a role-core band, because it decides which band applies.

**"Forward deployed" and "AI deployment" are two different jobs under nearly identical titles.**
The GTM and adoption version is her best target. The engineering version has a real SWE bar. Titles
are used loosely and **some manager-titled deployment roles smuggle in a coding screen**, so read
the requirements section and classify on that.

- Requirements are enterprise customers, adoption, onboarding, post-sales ownership, programme
  delivery, change management: **this is Tier 1.** Score it as such.
- Requirements are a coding screen, a take-home engineering assessment, system design, or shipping
  production code: **this is Tier 4.** Drop it, whatever the title says.

**"AI" in a title is noise** and carries close to no signal. Score on the work described.

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

- 45: **Tier 1.** Owns deployment or adoption of a platform inside a customer's operation, the GTM
  and adoption flavour
- 42: **Tier 1.** Technical account management or enterprise customer success at an AI platform.
  Slightly below the deployment band on ceiling, not on fit. This is the highest offer probability
  on the list and the fastest yes
- 40: **Tier 1.** Solutions consulting or pre-sales, the discovery-and-scoping flavour
- 38: product ownership of an internal decision or data tool
- 30: post-sales, enablement or solutions work at a technical company that is not an AI platform
- 26: **Tier 2.** Go-to-market strategy and operations, RevOps, product marketing, partnerships or
  business development **at a technology company**. Below post-sales on purpose. **She has not held
  a GTM role**, so this band is adjacency, not experience: the account portfolio, renewals, QBRs and
  expansion work is the nearest real thing and the GTM function itself is a gap. Name the gap in the
  rationale
- 22: **Tier 3.** Growth PM, AI PM, product analyst, BI, data science. Viable, but she is competing
  on the same axis as everyone else. Growth PM sits at the top of this band, above generic AI PM
- 20: adjacent commercial or programme work, including a GTM role outside technology
- 10: analyst work executing against someone else's spec

**Domain and system fit, up to 20.** Does the posting describe the specific problem she is good
at? Unreliable operational input, defining what a valid record is, getting a non-technical team
to adopt something. Full marks need the posting to say so, not for you to infer it.

Score the **work described**, never the word "AI" in the title. The signals that count: enterprise
or strategic accounts, post-sales ownership, adoption and onboarding, translating loosely-defined
technical goals into delivered programmes, change management with non-technical end users in a field
organisation, exec stakeholder exposure.

**Geography and timing, up to 15.** She is in New York from mid-August 2026 and the MEng runs to
May 2027, so location is about what she can actually take.

- 15: New York City, or genuinely remote-US
- 8: another US metro where the company has a New York office, so the requisition is worth a
  relationship even though the role itself is not actionable
- 4: **San Francisco.** Not actionable while she is enrolled. Worth tracking only for relationship
  building, and only where there is a New York office. Say so in the rationale
- 0: any other US city requiring relocation during the MEng

Roles outside the US score nothing here, and are excluded entirely by the filter in step 0.

**Company shape, up to 12.** Judge the company, not whether the word AI appears.

- 12: a model lab, AI platform or tooling company, or an AI-native startup or scaleup. Add the full
  12 for a company that **hires just-in-time** rather than on a campus cycle, since that matches her
  timeline where a structured new-grad pipeline does not
- 8: any other technology company. For a Tier 2 GTM role this is the right band whether or not the
  product is AI, because the transferable part is landing software
- 4: a traditional company with an AI initiative
- 0: no technology dimension at all

**Evidence the search is live, up to 8.** On the employer's own board and recently posted or
reposted gets 8. An aggregator listing you could not confirm gets 2.

## The caps. These override everything above.

- **Requires an ML model shipped to production, or engineering management: cap at 65.** She has
  not done either, and a 90 here wastes her week.
- **A go-to-market role that requires GTM or sales leadership experience she does not have: cap
  at 75.** Owning pipeline generation, partner or channel strategy, pricing and packaging, or a
  new-business quota is not on her record. GTM is a target, so keep emitting these, but a GTM
  posting reaching the strong band needs the job to be mostly account ownership, renewals,
  expansion or enablement, which she has actually done.
- **Requires 8 or more years in the exact function: cap at 75.**
- **A hard "3 plus years as a Product Manager" screen: cap at 70**, and **name the screen risk in
  the rationale**. She has no PM title on record. Deprioritise, do not auto-reject: the useful
  information is that she loses at the screen rather than in the loop, and that is exactly why the
  deployment and solutions organisations in Tier 1 are Tier 1, because they screen differently.
  A demand for 5 plus years of product management caps at 55.
- **Explicitly refuses visa sponsorship: cap at 40**, and say so in the rationale. She is F-1: CPT
  and OPT need no sponsorship, but she will need H-1B or equivalent long term, so a posting that
  rules sponsorship out is a real ceiling rather than a paperwork detail. If the posting is silent
  on sponsorship, do not apply this cap and do not raise the subject.
- **Requires a security clearance: cap at 20.**
- **The posting has internal inconsistencies: no cap, but flag it in the rationale.** A location
  mismatch between the header and the body, obvious typos, applications handled off-platform. For a
  Series A company this is not disqualifying, but she should confirm the real funnel before spending
  effort on it, and she can only do that if the digest tells her.

The step 0 filters are not caps and are not repeated here. A non-US role, a start date before May
2027, a no-CPT-accommodation requirement, a Tier 4 role and a posting you could not open are all
**dropped**, not scored low. A hallucinated opportunity is worse than a missed one, because it
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
