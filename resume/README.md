# The master resume

`prompts/resume-tailor.md` describes tailoring as a **diff against one fixed document**. This
folder is that document, so the prompt points at a file that exists in the repo rather than at an
attachment.

| File | What it is |
| --- | --- |
| `master-resume.md` | **The master.** The AI PM and GTM variant, in text. This is what the tailoring prompt reads |
| `render.mjs` | Markdown to a one-page PDF. Chromium, no new dependencies |
| `master-resume.pdf` | Generated from the markdown. Regenerate, do not edit |
| `Duaa-Khalid-resume-CSM.pdf` | The original CSM export. **Layout reference only.** Do not tailor from it |

## Producing the document

```
node resume/render.mjs                        # the master
node resume/render.mjs path/to/tailored.md    # a tailored version
CHROME_PATH=/path/to/chrome node resume/render.mjs
```

The prompts require the tailored resume "as a document, one page", and nothing in the repo could
produce one, so that step was a silent manual handoff and "one page" was unverifiable. `render.mjs`
counts the pages in the PDF it just wrote and **exits non-zero when a tailored file runs over one**,
so the constraint is checked rather than hoped for.

The master itself renders to two pages and that is fine. It is a superset that holds every bullet so
tailoring only ever drops, and it is not a document she sends. Only tailored output is held to one
page.

The print CSS in `render.mjs` is the layout contract, shared by every version. If a tailored file
overflows, **drop a bullet**, which the tailoring rules allow. Do not shrink the type, because then
each version she sends looks like a different document.

## Why the markdown is the master and the PDF is not

The PDF is the compiled output. Its text is glyph-subsetted with per-character positioning, so
editing a line in place means rewriting positioned glyph codes and the layout breaks. It cannot be
diffed either: a one-word change shows up as a new binary blob, which defeats the point of keeping
the resume in a repo at all.

So the markdown is the source of truth for **content**, the PDF is the reference for **layout**, and
a real edit happens in the markdown first.

## Why the master is the AI PM and GTM variant, not the CSM one

The rule is send the AI PM and GTM version, never the KAM version. The only PDF in the repo is the
CSM one, so using it as the master would mean every tailored resume descends from the wrong
document. `master-resume.md` is therefore structured as the AI PM and GTM variant:

- **No summary section.** Deliberate. Do not add one back.
- **Projects above Experience**, because reviewers read the top third and stop. The Beauty Advisor
  Sales Tracker leads, since it is the strongest and it is shipped work.
- **Titles exactly as on record**, with no invented prefixes.
- **Live links included**: `duaakhalid.com`, `sales-management-phi-blue.vercel.app`,
  `homebase-labs.lovable.app`.

## Known resume issues

Closed by the current `master-resume.md`:

- [x] **Homebase bullets described vision-layer features.** Now states what shipped, a CRUD app over
  six Firestore collections, and describes the deterministic-default design decision instead of the
  RERA, WhatsApp and agent layer, which was explicitly out of MVP scope.
- [x] **Job title versus the title on record.** No "Internal" prefix on the product owner role.
- [x] **Overlapping MSc and Dolce and Gabbana dates.** The MSc is now labelled part-time alongside
  full-time work, so the overlap reads correctly instead of looking like an error.
- [x] **`Dubai, UAE` in the contact line.** The markdown reads `New York, NY`.

Still open, and neither is mine to close:

- [ ] **The forecast reliability bullet may contradict what was said in a reviewer email.** It is
  still in `master-resume.md` under the LVMH role. Check the email before that bullet goes out, and
  cut it if the two do not agree. A bullet that contradicts something already in writing is the
  worst kind, because the contradiction is discoverable.
- [x] **The contact line read `Dubai, UAE` in the PDF.** Closed by `render.mjs`:
  `master-resume.pdf` is generated from the markdown and reads `New York, NY`. The original
  `Duaa-Khalid-resume-CSM.pdf` still says Dubai and always will, which is why it is a layout
  reference and not something to send.
- [ ] **The phone number is a UAE mobile**, `+971 56 364 0419`, sitting under a New York address.
  Left exactly as it is, because inventing a US number would be worse. It is normal for someone
  relocating, but decide it deliberately rather than hearing about it from a recruiter who did not
  call.

## The relationship to `prompts/profile.md`

`profile.md` is the **scoring** input: what she has done, what she has not, what she is targeting,
and the hard constraints that filter postings before scoring. `master-resume.md` is the **tailoring**
input: the document that gets reordered and trimmed for one posting.

They have to agree, and on any factual question the resume wins, because it is the document that
goes to an employer. When a number appears in one and not the other, put it in both or neither.
