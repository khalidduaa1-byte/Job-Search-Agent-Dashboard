/* ------------------------------------------------------------------
   Browser checks for the dashboard.

   There is no test framework and no dependency to add one, so this is a
   Playwright script driving the pre-installed Chromium against the app
   served over http. It asserts the behaviour CLAUDE.md calls
   non-negotiable, because those are the rules a later feature is most
   likely to quietly undo.

     python3 -m http.server 8000 &
     node tests/check.mjs

   Exits non-zero on the first failure.
------------------------------------------------------------------ */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const digest = JSON.parse(readFileSync(new URL('../data/sample-digest.json', import.meta.url)));

let pass = 0;
const fails = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fails.push(name + (detail ? ` (${detail})` : '')); console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* Import through the real dialog rather than by calling into the module,
   so the validation and reporting path is what gets exercised. */
async function importJSON(page, rows) {
  await page.click('#import-open');
  await page.fill('#import-txt', JSON.stringify(rows));
  await page.click('#import-run');
  await page.waitForSelector('#import-report:not([hidden])');
  const text = await page.textContent('#import-report');
  await page.click('#import-cancel');
  return text;
}

const board = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('jsd.board.v1') || '{"items":[]}').items);

const rowIds = (page) => page.$$eval('.row', (n) => n.map((r) => r.dataset.id));

/* Back to the ten seeded rows and no filters. Sections that assert on exact
   counts start from here, so an earlier section marking something applied
   cannot silently change what a later one is measuring. */
async function reset(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('#load-sample');
  await page.waitForSelector('.row');
}

/* Use whatever Chromium is already on the machine when one is pointed at, rather
   than downloading a second copy that has to match the npm package's build
   number. CHROME_PATH is the override; without it Playwright looks in its own
   browsers directory as usual. */
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
page.on('pageerror', (e) => { fails.push('uncaught page error: ' + e.message); });

/* -- Empty state ---------------------------------------------------- */
console.log('\nEmpty state');
await page.goto(BASE, { waitUntil: 'networkidle' });
ok('empty state is visible on a fresh board', await page.isVisible('#empty'));
eq('stat tiles start at zero',
  await page.$$eval('.stat-n', (n) => n.map((x) => x.textContent)), ['0', '0', '0', '0']);
ok('last updated reads never', (await page.textContent('#last-updated')) === 'never');

/* -- Sample data --------------------------------------------------- */
console.log('\nSample data');
await page.click('#load-sample');
await page.waitForSelector('.row');
const seeded = await board(page);
eq('sample data seeds ten rows', seeded.length, 10);
ok('toast reports what was added',
  (await page.textContent('#toast')).includes('10 added'));
ok('empty state is gone', !(await page.isVisible('#empty')));

/* The four tiles are derived, so their definitions are the assertion.
   Sample board: 8 not hidden, 4 at 90 plus, 3 applied/interviewing/offer,
   4 in the pipeline. This is the state in the reference screenshot. */
eq('derived stat tiles',
  await page.$$eval('.stat-n', (n) => n.map((x) => x.textContent)), ['8', '4', '3', '4']);
eq('five rows to action, three already in the pipeline',
  (await page.textContent('#result-count')).trim(), '5 to action, 3 already in your pipeline');
eq('the jobs chip counts the latest report', await page.textContent('#latest-count'), '8');
eq('best opportunity is the highest score on the board',
  await page.textContent('#best-company'), 'Lumina Systems');
ok('best opportunity meta carries role, place and score',
  (await page.textContent('#best-meta')) === 'AI Deployment Manager · New York, NY · 96 match score',
  await page.textContent('#best-meta'));
eq('rows are ordered by score, highest first',
  await page.$$eval('.score', (n) => n.map((x) => x.textContent)), ['93', '88', '84', '78', '72']);
eq('hidden roles are in the rail, not the list',
  await page.$$eval('#hidden-list li', (n) => n.length), 2);
eq('pipeline counts', await page.$$eval('.pipe-n', (n) => n.map((x) => x.textContent)),
  ['1', '2', '1', '0', '2']);

/* -- The employer must not run into the role title ------------------
   This was a real bug: both were inline spans and rendered as
   "LUMINA SYSTEMSAI Deployment Manager". A grep cannot catch it, only
   geometry can. */
console.log('\nLayout of a row');
const stacked = await page.$eval('.row', (r) => {
  const co = r.querySelector('.row-co').getBoundingClientRect();
  const ti = r.querySelector('.row-title').getBoundingClientRect();
  return { below: ti.top >= co.bottom - 1, sameLeft: Math.abs(ti.left - co.left) < 2 };
});
ok('role title sits below the employer label', stacked.below);
ok('role title is left aligned with the employer label', stacked.sameLeft);

/* -- Apply is one click and does not toggle the fold ---------------- */
console.log('\nApply link');
const firstRow = page.locator('.row').first();
ok('apply link is in the summary row', await firstRow.locator('summary .row-apply').count() === 1);
eq('apply link opens in a new tab',
  await firstRow.locator('.row-apply').getAttribute('target'), '_blank');
eq('apply link is safe against tab-nabbing',
  await firstRow.locator('.row-apply').getAttribute('rel'), 'noopener');
ok('row starts closed', !(await firstRow.evaluate((r) => r.open)));
/* Clicking it must not expand the row. Intercept the navigation so the
   test does not depend on the posting host existing. */
await page.route('**/*', (route) => {
  if (route.request().isNavigationRequest() && !route.request().url().startsWith(BASE)) return route.abort();
  return route.continue();
});
await firstRow.locator('.row-apply').click({ modifiers: ['Control'] }).catch(() => {});
ok('clicking apply does not expand the row', !(await firstRow.evaluate((r) => r.open)));
await page.unroute('**/*');

/* -- The row opens, and its facts are the record -------------------- */
console.log('\nRow disclosure');
await firstRow.locator('summary').click();
ok('row expands on the summary', await firstRow.evaluate((r) => r.open));
ok('rationale is shown when open', (await firstRow.locator('.row-why').textContent()).length > 20);
ok('status select is present', await firstRow.locator('[data-act="status"]').count() === 1);
ok('notes field is present', await firstRow.locator('[data-act="notes"]').count() === 1);

/* -- Notes and status persist -------------------------------------- */
console.log('\nHuman-owned state');
await firstRow.locator('[data-act="notes"]').fill('Spoke to the recruiter on Tuesday.');
await firstRow.locator('[data-act="notes"]').blur();
await page.locator('.row').first().locator('summary').click().catch(() => {});
await page.reload({ waitUntil: 'networkidle' });
const afterReload = (await board(page)).find((r) => r.company === 'Halyard Compute');
eq('notes survive a reload', afterReload.notes, 'Spoke to the recruiter on Tuesday.');

/* -- Rule 1: an import must never overwrite the human's triage ------
   The most important assertion in the repo. Set a status by hand, then
   re-import a digest that carries a different status for the same row. */
console.log('\nRule 1, an import must not overwrite triage');
await page.selectOption('.row:first-of-type [data-act="status"]', 'saved').catch(async () => {
  await page.locator('.row').first().locator('summary').click();
  await page.locator('.row').first().locator('[data-act="status"]').selectOption('saved');
});
await page.waitForTimeout(50);

/* A deliberately hostile digest: the agent emitting human-owned fields for
   rows the board has already seen. All three must be ignored. Only the two
   rows already on the board go in here, because the contract does let those
   fields act as defaults for a genuinely new row, which is asserted below. */
const hostile = digest
  .filter((r) => r.company !== 'Meridian Field')
  .map((r) => ({ ...r, status: 'new', hidden: true, notes: 'AGENT OVERWROTE THIS' }));
const report1 = await importJSON(page, hostile);
const merged = await board(page);
const halyard = merged.find((r) => r.company === 'Halyard Compute');
eq('the status the human set is untouched', halyard.status, 'saved');
eq('the notes the human wrote are untouched', halyard.notes, 'Spoke to the recruiter on Tuesday.');
eq('the hidden flag the human set is untouched', halyard.hidden, false);
ok('the agent-owned score did refresh', halyard.score === 93, 'score ' + halyard.score);
ok('the import report says triage was kept', report1.includes('kept their status'), report1);
eq('a hostile re-import adds no rows', merged.length, 10);

/* -- The dedup key ignores the tracking query string ----------------
   sample-digest.json carries ?utm_source=digest on a posting already on
   the board. Without normalisation it imports as a second row. */
console.log('\nDedup key');
ok('utm_source did not create a duplicate Lumina row',
  merged.filter((r) => r.company === 'Lumina Systems').length === 1);
const report2 = await importJSON(page, digest);
/* The digest carries one posting the sample board does not have, so a full
   import is 1 added and 2 updated, not 0 added. That one row is the check
   that dedup is matching on the key and not just refusing everything. */
ok('the one genuinely new posting is added', /1 added, 2 updated/.test(report2), report2);
eq('and only that one', (await board(page)).length, 11);
const report3 = await importJSON(page, digest);
ok('importing the same digest twice more adds nothing',
  /0 added, 3 updated/.test(report3), report3);
eq('still eleven rows', (await board(page)).length, 11);

/* -- Rule 2: an applied role does not come back --------------------- */
console.log('\nRule 2, an applied role does not come back');
await page.selectOption('#f-status', 'all');
const before = await rowIds(page);
await page.locator('.row').first().locator('summary').click();
await page.locator('.row').first().locator('[data-act="applied"]').click();
await page.waitForTimeout(50);
const afterApply = await rowIds(page);
eq('the applied row leaves the daily list', afterApply.length, before.length - 1);
ok('and it is the row that was applied to', !afterApply.includes(before[0]));
await importJSON(page, digest);
eq('re-importing the whole digest does not bring it back', await rowIds(page), afterApply);
const appliedRec = (await board(page)).find((r) => r.id === before[0]);
eq('its status is still applied', appliedRec.status, 'applied');
ok('it is not deleted, it is on the board', !!appliedRec);
/* And it is recoverable, which is what makes the filter defensible. */
await page.click('.pipe-btn[data-status="applied"]');
await page.waitForTimeout(50);
ok('the pipeline row brings applied roles back into view',
  (await rowIds(page)).includes(before[0]));
eq('the pipeline row drives the status select', await page.inputValue('#f-status'), 'applied');
await page.click('#clear');
await page.waitForTimeout(50);
eq('Clear resets the status filter', await page.inputValue('#f-status'), 'all');

/* -- Hiding is reversible ------------------------------------------ */
console.log('\nHiding');
await reset(page);
const beforeHide = await rowIds(page);
await page.locator('.row').first().locator('summary').click();
await page.locator('.row').first().locator('[data-act="hide"]').click();
await page.waitForTimeout(50);
eq('hiding removes the row from the list', (await rowIds(page)).length, beforeHide.length - 1);
eq('hidden roles land in the rail', await page.$$eval('#hidden-list li', (n) => n.length), 3);
eq('and the roles-in-view tile drops', await page.textContent('#s-inview'), '7');
await page.click('#hidden-list li:last-child [data-act="restore"]');
await page.waitForTimeout(50);
eq('restore puts it back', await page.$$eval('#hidden-list li', (n) => n.length), 2);
eq('nothing was deleted by hiding', (await board(page)).length, 10);
eq('and the tile recovers', await page.textContent('#s-inview'), '8');

/* -- Filters compose ----------------------------------------------- */
console.log('\nFilters');
await reset(page);
await page.fill('#q', 'harborline');
await page.waitForTimeout(50);
eq('free text search narrows the list', (await rowIds(page)).length, 1);
await page.selectOption('#f-score', 'strong');
await page.waitForTimeout(50);
eq('search and score band compose', (await rowIds(page)).length, 0);
ok('an empty result explains itself rather than going blank',
  (await page.textContent('#rows')).length > 20);
await page.click('#clear');
await page.fill('#q', '');
await page.waitForTimeout(50);
await page.selectOption('#f-score', 'strong');
await page.waitForTimeout(50);
eq('score band alone matches the 90-plus rows still to action',
  await page.$$eval('.score', (n) => n.map((x) => x.textContent)), ['93']);
await page.click('#clear');
await page.waitForTimeout(50);

/* -- Validation is forgiving but loud ------------------------------ */
console.log('\nValidation');
await reset(page);
const bad = [
  { company: 'No Title Co', score: 80, rationale: 'x' },
  { title: 'Score Too High', company: 'Bad Score Co', score: 999, rationale: 'x' },
  { title: 'Not An Object', company: 'x', score: 'eighty', rationale: 'x' },
  'a string, not an object',
  {
    title: 'Coerced But Kept', company: 'Tolerant Co', location: 'Austin, TX',
    remote: 'telepathic', source: 'greenhouse', score: 91, band: 'weak',
    url: 'javascript:alert(1)', rationale: 'Lands with defaults and a warning.',
    signal: 'employer board page active', resume_tailored: false
  }
];
const badReport = await importJSON(page, bad);
ok('four bad rows rejected by row number', /4 rejected/.test(badReport), badReport);
ok('the missing title is named', /row 1.*title/i.test(badReport), badReport);
ok('the out-of-range score is named', /row 2.*score/i.test(badReport), badReport);
ok('the non-numeric score is named', /row 3.*score/i.test(badReport), badReport);
ok('the non-object row is named', /row 4.*not a JSON object/i.test(badReport), badReport);
ok('the good row still landed', /1 added/.test(badReport), badReport);
const kept = (await board(page)).find((r) => r.company === 'Tolerant Co');
eq('an unknown arrangement is coerced, not rejected', kept.remote, 'unknown');
eq('a band that disagrees with the score is corrected', kept.band, 'strong');
eq('a non-http url is dropped', kept.url, '');
ok('the coercions were reported as warnings',
  /telepathic/.test(badReport) && /disagrees/.test(badReport), badReport);
eq('the rejected rows are not on the board',
  (await board(page)).filter((r) => /Bad Score|No Title/.test(r.company)).length, 0);

/* A javascript: url must not survive into the DOM anywhere. */
const hrefs = await page.$$eval('a[href]', (n) => n.map((a) => a.getAttribute('href')));
ok('no javascript: url reaches an href', !hrefs.some((h) => /^javascript:/i.test(h)));

/* -- Invalid JSON is a message, not a stack trace ------------------ */
await page.click('#import-open');
await page.fill('#import-txt', '{ not json');
await page.click('#import-run');
await page.waitForSelector('#import-report:not([hidden])');
ok('invalid JSON is reported in the dialog',
  (await page.textContent('#import-report')).includes('not valid JSON'));
await page.click('#import-cancel');

/* -- Export -------------------------------------------------------- */
console.log('\nExport');
const dl = await Promise.all([page.waitForEvent('download'), page.click('#export')]).then((r) => r[0]);
ok('export filename is dated', /^jsd-board-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()),
  dl.suggestedFilename());
const exported = JSON.parse(readFileSync(await dl.path(), 'utf8'));
eq('export carries the whole board', exported.length, (await board(page)).length);
ok('export includes the hidden rows', exported.some((r) => r.hidden === true));
ok('export includes the human fields',
  exported.every((r) => 'status' in r && 'notes' in r && 'hidden' in r));

/* -- Accessibility, the parts that are structural ------------------ */
console.log('\nAccessibility');
ok('pipeline rows are real buttons',
  await page.$$eval('.pipe-btn', (n) => n.every((b) => b.tagName === 'BUTTON')));
ok('pipeline buttons report their pressed state',
  await page.$$eval('.pipe-btn', (n) => n.every((b) => b.hasAttribute('aria-pressed'))));
ok('every control has an accessible name',
  await page.$$eval('input, select, textarea', (n) => n.every((c) =>
    c.getAttribute('aria-label') || c.labels?.length)));
ok('the toast is a live region', await page.getAttribute('#toast', 'aria-live') === 'polite');
ok('there is exactly one h1', await page.$$eval('h1', (n) => n.length) === 1);
ok('no interactive element is scaled on hover',
  !readFileSync(new URL('../styles.css', import.meta.url), 'utf8').includes('transform: scale'));

/* -- 390px, in an iframe -------------------------------------------
   Headless Chrome clamps its window to about 500px, so a narrow
   --window-size crops instead of reflowing and looks exactly like an
   overflow bug. An iframe actually reflows. */
console.log('\nNarrow viewport');
const frame = await page.evaluateHandle(async (base) => {
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:800px;border:0;position:fixed;left:0;top:0;z-index:999';
  f.src = base;
  document.body.appendChild(f);
  await new Promise((res) => { f.onload = res; });
  return f;
}, BASE);
const narrow = await frame.evaluate((f) => {
  const d = f.contentDocument;
  return { scroll: d.documentElement.scrollWidth, client: d.documentElement.clientWidth };
});
eq('no horizontal overflow at 390px', narrow.scroll, narrow.client);

await browser.close();

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
