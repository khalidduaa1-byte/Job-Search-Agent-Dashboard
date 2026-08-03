/* ------------------------------------------------------------------
   Render a resume markdown file to a one-page PDF.

   The prompts require a tailored resume "as a document, one page", and
   nothing in the repo could produce one, so that step was a manual
   handoff and "one page" was unverifiable. This closes it.

     node resume/render.mjs                        # the master
     node resume/render.mjs path/to/tailored.md    # a tailored version
     node resume/render.mjs in.md out.pdf

   It also regenerates the master PDF, which is how the contact line
   finally reads New York, NY. The shipped CSM PDF still says Dubai and
   could not be edited in place: its text is glyph-subsetted with
   per-character positioning, so rewriting a line means rewriting
   positioned glyph codes and the layout breaks. Rendering from the
   markdown sidesteps that entirely.

   Chromium does the PDF, the same one tests/check.mjs uses. Set
   CHROME_PATH if Playwright's bundled build is missing or mismatched.

   Exits non-zero when the output runs over one page, because a two-page
   resume that claims to be one page is the failure worth catching.
------------------------------------------------------------------ */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const here = new URL('.', import.meta.url);
const src = process.argv[2] || new URL('master-resume.md', here).pathname;
const out = process.argv[3] || src.replace(/\.md$/, '.pdf');

/* A deliberately small markdown subset: headings, bold, italic, links,
   list items, horizontal rules. A resume needs nothing else, and a full
   markdown library would be the first dependency in a repo that has
   none. Anything unsupported passes through as text rather than
   silently vanishing. */
function inline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function toHtml(md) {
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  /* Strip HTML comments before splitting into lines. Skipping only lines that
     start with "<!--" left the continuation of a multi-line comment in the
     document, so "Experience because reviewers read the top third and stop. -->"
     rendered inside the resume. Dropped straight onto a page she sends. */
  md = md.replace(/<!--[\s\S]*?-->/g, '');

  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }

    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

/* Print CSS. Tuned to fit one page, and it is the layout contract: change
   it here rather than per tailored file, so every version she sends looks
   like the same document. */
const css = `
  @page { size: Letter; margin: 0.5in 0.55in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font: 400 9.6pt/1.35 Georgia, 'Times New Roman', serif; color: #111; }
  h1 { font-size: 19pt; letter-spacing: -0.01em; margin-bottom: 2pt; text-align: center; }
  h1 + p { text-align: center; font-size: 8.4pt; color: #333; margin-bottom: 9pt; }
  h2 {
    font: 700 8.6pt/1.2 Helvetica, Arial, sans-serif;
    letter-spacing: 0.11em; text-transform: uppercase;
    border-bottom: 0.6pt solid #999;
    padding-bottom: 2pt; margin: 10pt 0 5pt;
  }
  h3 { font-size: 10.2pt; margin-top: 6pt; }
  h3 + p { font-size: 9.2pt; }
  p { margin-bottom: 2pt; }
  ul { margin: 3pt 0 4pt 12pt; }
  li { margin-bottom: 2.2pt; padding-left: 1pt; }
  a { color: #111; text-decoration: none; }
  code { font-family: inherit; }
  strong { font-weight: 700; }
  h2, h3 { break-after: avoid; page-break-after: avoid; }
  li { break-inside: avoid; page-break-inside: avoid; }
`;

const md = readFileSync(src, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><title>${basename(src)}</title>
<style>${css}</style>${toHtml(md)}`;

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
const pdf = await page.pdf({ format: 'Letter', printBackground: true,
  margin: { top: '0.5in', bottom: '0.5in', left: '0.55in', right: '0.55in' } });
await browser.close();

writeFileSync(out, pdf);

/* Count pages from the PDF itself rather than trusting the CSS. */
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length || 1;
const kb = (pdf.length / 1024).toFixed(0);
console.log(`${basename(src)} -> ${out}  ${pages} page${pages === 1 ? '' : 's'}, ${kb}K`);

/* The master is a superset on purpose: it carries every bullet so that
   tailoring is a matter of dropping rather than writing. It is expected to
   run long and it is not a document she sends, so a second page is a note
   here, not a failure. A tailored file is what goes to an employer, and for
   that one page is the contract. */
const isMaster = /master-resume\.md$/.test(src);

if (pages > 1 && isMaster) {
  console.log(
    `\nThe master runs to ${pages} pages, which is fine. It holds every bullet so that\n` +
    `tailoring only ever drops. A tailored version has to fit one page, and this script\n` +
    `exits non-zero when one does not.`);
} else if (pages > 1) {
  console.error(
    `\nOver one page. prompts/resume-tailor.md requires one, so this would fail review.\n` +
    `Drop a bullet rather than shrinking the type: the tailoring rules allow dropping and\n` +
    `the type size here is the layout contract, shared by every version she sends.`);
  process.exit(1);
}
