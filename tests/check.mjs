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
/* The chip counts what ARRIVED, not what was seen. Sample data is a first
   import so all eight are new, and #latest-seen is empty. */
eq('the jobs chip counts what arrived today', await page.textContent('#latest-count'), '8');
eq('and says nothing extra when everything is new', await page.textContent('#latest-seen'), '');
/* The hero card is a recommendation, so it must skip roles already actioned.
   Lumina is the highest score on the sample board at 96 and is already applied;
   Halyard at 93 is the best thing she can act on today. This used to read
   Lumina every morning after she had applied, while the list below correctly
   omitted it. */
eq('best opportunity skips a role already applied to',
  await page.textContent('#best-company'), 'Halyard Compute');
ok('best opportunity meta carries role, place and score',
  (await page.textContent('#best-meta')) === 'Deployment Strategist · New York, NY · 93 match score',
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
ok('and the message says what a good paste looks like',
  (await page.textContent('#import-report')).includes('first'));
await page.click('#import-cancel');

/* -- A fenced paste, which is the likeliest one --------------------
   The digest puts the array in a markdown code block and a phone mail client
   renders the fence literally, so this is what actually gets pasted before
   work. Failing it would break the only manual step in the pipeline. */
console.log('\nFenced and prefixed pastes');
await reset(page);
const fenced = '```json\n' + JSON.stringify(digest) + '\n```';
await page.click('#import-open');
await page.fill('#import-txt', fenced);
await page.click('#import-run');
await page.waitForSelector('#import-report:not([hidden])');
const fencedReport = await page.textContent('#import-report');
await page.click('#import-cancel');
ok('a markdown code fence is stripped rather than rejected',
  /1 added, 2 updated/.test(fencedReport), fencedReport);

/* Trailing prose after the closing fence, and a four-backtick fence. Markdown
   uses four whenever the content itself contains a fence, and the prompt files
   do. Both used to fail with "unexpected non-whitespace character". */
for (const [label, payload] of [
  ['trailing prose after the fence',
    '```json\n' + JSON.stringify(digest) + '\n```\n\nPaste that into the dashboard. Good luck.'],
  ['a four-backtick fence',
    '````json\n' + JSON.stringify(digest) + '\n````'],
]) {
  await page.click('#import-open');
  await page.fill('#import-txt', payload);
  await page.click('#import-run');
  await page.waitForSelector('#import-report:not([hidden])');
  const r = await page.textContent('#import-report');
  await page.click('#import-cancel');
  ok(label + ' still imports', /updated/.test(r) && !/not valid JSON/.test(r), r.slice(0, 120));
}

const prefixed = 'Paste into the dashboard:\n\n' + JSON.stringify(digest);
await page.click('#import-open');
await page.fill('#import-txt', prefixed);
await page.click('#import-run');
await page.waitForSelector('#import-report:not([hidden])');
const prefixedReport = await page.textContent('#import-report');
await page.click('#import-cancel');
ok('leading prose before the array is tolerated',
  /0 added, 3 updated/.test(prefixedReport), prefixedReport);

/* -- An import carrying a human-owned field is reported ------------
   The merge ignores these for a row already on the board, but for a NEW row
   they are read as defaults, so a digest with "hidden": true landed a strong
   role invisible and nothing said so.

   This section resets, so it goes AFTER every assertion that depends on the
   running import count above. Putting it in the middle made the next
   assertion measure a freshly seeded board, which is exactly the kind of
   ordering coupling reset() exists to avoid. */
console.log('\nHuman-owned fields in a digest');
await reset(page);
const offSpec = [{
  title: 'Off Spec Role', company: 'Overreaching Agent Co', location: 'New York, NY',
  remote: 'hybrid', source: 'greenhouse', url: 'https://example-boards.test/offspec/1',
  apply_url: 'https://example-boards.test/offspec/1/apply', posted: '2026-08-01',
  score: 95, rationale: 'Strong on paper, but the agent also sent hidden and status.',
  signal: 'employer board page active', resume_tailored: false,
  hidden: true, status: 'closed', notes: 'agent wrote this'
}];
const offSpecReport = await importJSON(page, offSpec);
ok('an import carrying hidden is warned about', /carried "hidden"/.test(offSpecReport), offSpecReport);
ok('an import carrying status is warned about', /carried "status"/.test(offSpecReport));
ok('an import carrying notes is warned about', /carried "notes"/.test(offSpecReport));
ok('the row still landed rather than being rejected', /1 added/.test(offSpecReport));
ok('and it landed hidden, which is the point of the warning',
  (await board(page)).find((r) => r.company === 'Overreaching Agent Co').hidden === true);

/* -- A board where every row is hidden ----------------------------
   The header used to read "Nothing imported yet" and "No reports yet" here,
   which is false, and the empty state does not show either because it is gated
   on the board being empty rather than the view being empty. Needs its own
   board: the section above still has the eight visible sample rows. */
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await importJSON(page, offSpec);
eq('an all-hidden board says so rather than claiming nothing was imported',
  await page.textContent('#best-company'), 'Everything is hidden');
ok('and points at where the rows went',
  (await page.textContent('#best-meta')).includes('Hidden roles'),
  await page.textContent('#best-meta'));
eq('the latest-report line does not claim there are no reports',
  await page.textContent('#latest-date'), 'All hidden');

/* -- The same posting from a second board -------------------------
   The agent has no memory of which board it used yesterday, so a role she has
   applied to can come back under an aggregator URL. With a URL-only dedup key
   that imported as a fresh row at status new and defeated rule 2. */
console.log('\nDedup across two boards');
await reset(page);
await page.locator('.row').first().locator('summary').click();
await page.locator('.row').first().locator('[data-act="applied"]').click();
await page.waitForTimeout(50);
const listAfterApply = await rowIds(page);
const reHalyard = (await board(page)).find((r) => r.company === 'Halyard Compute');
eq('the role is applied', reHalyard.status, 'applied');
const reboarded = [{
  title: reHalyard.title, company: reHalyard.company, location: reHalyard.location,
  remote: reHalyard.remote, source: 'linkedin',
  url: 'https://example-aggregator.test/jobs/' + reHalyard.id,
  apply_url: 'https://example-aggregator.test/jobs/' + reHalyard.id + '/apply',
  posted: reHalyard.posted, score: reHalyard.score,
  rationale: 'Same posting, found on an aggregator under a different URL.',
  signal: 'aggregator listing', resume_tailored: false
}];
const reboardReport = await importJSON(page, reboarded);
ok('the same role from another board updates rather than adding',
  /0 added, 1 updated/.test(reboardReport), reboardReport);
eq('the board did not grow', (await board(page)).length, 10);

/* An aggregator rewrites the location as well as the URL, which is the case
   that actually happens. "New York, NY" against "New York, New York" against
   "New York, NY (Hybrid)" are three strings for one place, and each one used to
   land a fresh row at status new, putting an applied role back in the list. */
for (const loc of ['New York, New York', 'New York, NY (Hybrid)', 'NEW YORK NY']) {
  const variant = [Object.assign({}, reboarded[0], {
    location: loc,
    url: 'https://example-aggregator.test/v/' + encodeURIComponent(loc)
  })];
  const r = await importJSON(page, variant);
  ok('a rewritten location does not fork the row: ' + loc, /0 added/.test(r), r.slice(0, 90));
}
eq('still ten rows after three location variants', (await board(page)).length, 10);
eq('and it is still applied',
  (await board(page)).find((x) => x.company === 'Halyard Compute').status, 'applied');
eq('and it did not come back into the daily list', await rowIds(page), listAfterApply);
eq('its applied status survived',
  (await board(page)).find((r) => r.company === 'Halyard Compute').status, 'applied');

/* -- The agent brief ----------------------------------------------
   The scheduled task cannot read this board, so the brief is the only thing
   that stops it re-emitting a role she has actioned. Assert it names the
   applied and hidden rows, and the unactioned 90-plus ones. */
console.log('\nAgent brief');
await reset(page);
await page.evaluate(() => navigator.clipboard.writeText = undefined);
const briefDl = await Promise.all([page.waitForEvent('download'), page.click('#brief')])
  .then((r) => r[0]);
const briefText = readFileSync(await briefDl.path(), 'utf8');
ok('brief filename is dated', /^agent-brief-\d{4}-\d{2}-\d{2}\.md$/.test(briefDl.suggestedFilename()),
  briefDl.suggestedFilename());
ok('brief lists an applied role to skip', /Lumina Systems \| AI Deployment Manager \| applied/.test(briefText));
ok('and carries its url, so the agent can match on something an aggregator cannot mangle',
  /applied \| https:\/\//.test(briefText), briefText.split('\n').slice(0, 8).join(' / '));
ok('brief lists a hidden role to skip', /Pinebrook Logistics .* \| hidden/.test(briefText));
ok('brief lists the interviewing role to skip', /Northwind AI .* \| interviewing/.test(briefText));
ok('brief does not tell the agent to skip an actionable role',
  !/Halyard Compute \| Deployment Strategist \| (applied|hidden|interviewing)/.test(briefText));
ok('brief names the unactioned 90-plus role for the Friday roundup',
  /93 \| Halyard Compute/.test(briefText), briefText.slice(-300));
/* Split on the section heading itself, not on a phrase. Splitting on
   "not actioned" broke as soon as the skip section grew a comment containing
   the same words, which made the assertion measure the wrong half of the file. */
ok('brief excludes actioned roles from the unactioned list',
  briefText.split('## Scored 90 plus')[1].indexOf('Lumina') === -1,
  briefText.split('## Scored 90 plus')[1]);

/* -- Export -------------------------------------------------------- */
console.log('\nExport');
await reset(page);
const dl = await Promise.all([page.waitForEvent('download'), page.click('#export')]).then((r) => r[0]);
ok('export filename is dated', /^jsd-board-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()),
  dl.suggestedFilename());
const exportedFile = JSON.parse(readFileSync(await dl.path(), 'utf8'));
/* The generation date has to be INSIDE the file. weekly-roundup.md requires the
   roundup to say when its input was taken, and the filename does not survive a
   paste, which is how the prompt says the export arrives. */
ok('export carries its own generation date', /^\d{4}-\d{2}-\d{2}$/.test(exportedFile.exported),
  JSON.stringify(exportedFile.exported));
const exported = exportedFile.items;
eq('export carries the whole board', exported.length, (await board(page)).length);
ok('export includes the hidden rows', exported.some((r) => r.hidden === true));
ok('export includes the human fields',
  exported.every((r) => 'status' in r && 'notes' in r && 'hidden' in r));

/* Round trip: a wrapped export must restore, and so must an older bare array,
   because exports taken before this change are still on her disk. */
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
const wrappedReport = await importJSON(page, exportedFile);
ok('a wrapped export restores the board', /10 added/.test(wrappedReport), wrappedReport);
eq('with the human fields intact',
  (await board(page)).filter((r) => r.hidden).length, 2);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
const bareReport = await importJSON(page, exported);
ok('and a bare-array export from an older version still restores',
  /10 added/.test(bareReport), bareReport);

/* -- The retitled repost, which no exact key catches ---------------
   An aggregator republishes the same job with its own URL and a suffix on the
   title. Both keys differ, so this used to import as a second row at status
   new and put an applied role back in the daily list. */
console.log('\nRetitled repost');
await reset(page);
await page.locator('.row').first().locator('summary').click();
await page.locator('.row').first().locator('[data-act="applied"]').click();
await page.waitForTimeout(50);
const beforeRepost = await rowIds(page);
const applied = (await board(page)).find((r) => r.status === 'applied' && r.company === 'Halyard Compute');
const retitled = [{
  title: applied.title + ' - New York (Hybrid)', company: applied.company,
  location: 'New York, New York', remote: 'hybrid', source: 'linkedin',
  url: 'https://example-aggregator.test/retitled/1',
  apply_url: 'https://example-aggregator.test/retitled/1/apply',
  posted: applied.posted, score: applied.score,
  rationale: 'Same job, republished by an aggregator with a suffix on the title.',
  signal: 'aggregator listing', resume_tailored: false
}];
const retitledReport = await importJSON(page, retitled);
ok('a retitled repost updates rather than adding',
  /0 added, 1 updated/.test(retitledReport), retitledReport);
ok('and says it matched loosely, so a wrong merge is visible',
  /retitled repost/.test(retitledReport), retitledReport);
eq('the board did not grow', (await board(page)).length, 10);
eq('the applied role did not return to the list', await rowIds(page), beforeRepost);

/* The guard against over-merging: two genuinely different roles at one employer
   whose titles differ by a word each are NOT a subset either way. */
const twoRoles = ['Growth', 'Platform'].map((flavour, n) => ({
  title: 'Product Manager, ' + flavour, company: 'Sibling Roles Co',
  location: 'New York, NY', remote: 'hybrid', source: 'greenhouse',
  url: 'https://example-boards.test/sibling/' + n,
  apply_url: 'https://example-boards.test/sibling/' + n, posted: '2026-08-01',
  score: 80, rationale: 'Distinct role at the same employer.',
  signal: 'employer board page active', resume_tailored: false
}));
const siblingReport = await importJSON(page, twoRoles);
ok('two distinct roles at one employer stay two rows',
  /2 added/.test(siblingReport), siblingReport);

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

/* -- resume_tailored is not sticky --------------------------------
   The agent emits this boolean on every record, so or-ing it with the existing
   value meant that once true it was true forever: Monday tailored a resume,
   Tuesday did not, and the row still claimed one had been sent. The badge then
   accumulates across the week and stops meaning "today's". */
console.log('\nresume_tailored');
await reset(page);
const tailoredRow = {
  title: 'Tailored Today', company: 'Badge Test Co', location: 'New York, NY',
  remote: 'hybrid', source: 'greenhouse', url: 'https://example-boards.test/badge/1',
  apply_url: 'https://example-boards.test/badge/1', posted: '2026-08-01',
  score: 95, rationale: 'Top pick, so a resume was tailored for it.',
  signal: 'employer board page active', resume_tailored: true
};
await importJSON(page, [tailoredRow]);
eq('resume_tailored lands true', (await board(page)).find((r) => r.company === 'Badge Test Co').resume_tailored, true);
await importJSON(page, [Object.assign({}, tailoredRow, { resume_tailored: false })]);
eq('and a later digest that did not tailor clears it',
  (await board(page)).find((r) => r.company === 'Badge Test Co').resume_tailored, false);

/* -- Auto-import from a published digest ---------------------------
   The board cannot be written to from outside, so the daily routine commits its
   digest to the repo and the board picks it up on load. That is what makes the
   site fill itself, and these are the assertions that make it safe to run on
   every single page load.

   Needs a separate origin serving data/digests, since the repo's own index is
   empty by design. AUTO_BASE points at it; without it these checks are skipped
   rather than silently passing. */
console.log('\nAuto-import');
if (!process.env.AUTO_BASE) {
  console.log('  skip  set AUTO_BASE to a site serving data/digests to run these');
} else {
  const AUTO = process.env.AUTO_BASE;
  const seenDates = (pg) => pg.evaluate(() =>
    JSON.parse(localStorage.getItem('jsd.digests.v1') || '{"seen":[]}').seen);

  const auto = await browser.newPage();
  await auto.goto(AUTO, { waitUntil: 'domcontentloaded' });
  await auto.waitForTimeout(1200);

  eq('a published digest imports itself with no paste', (await board(auto)).length, 3);
  ok('and the toast says what it did',
    /Imported .*3 added/.test(await auto.textContent('#toast')),
    await auto.textContent('#toast'));
  /* The ledger key is date PLUS a content hash, not the date alone. Keyed on date
     only, a corrected digest could never land: a re-fired routine rewrites
     today's file, the ledger already holds today's date, and the board skips it
     forever. */
  const ledger = await seenDates(auto);
  eq('one digest recorded in the ledger', ledger.length, 1);
  ok('and the key carries a content hash, not just the date',
    /^2026-07-30:op_[a-z0-9]+$/.test(ledger[0]), JSON.stringify(ledger));
  /* first_seen has to come from the digest, not the day it was read. The jobs
     chip counts arrivals by first_seen, so stamping today would make a week-old
     row look like it turned up this morning. */
  ok('first_seen comes from the digest date, not today',
    (await board(auto)).every((r) => r.first_seen === '2026-07-30'),
    JSON.stringify((await board(auto)).map((r) => r.first_seen)));

  /* The assertion that matters most: a re-import bumps last_seen on every row,
     which is silent and cumulative, so a reload must be a no-op. */
  const beforeReload = await board(auto);
  await auto.reload({ waitUntil: 'domcontentloaded' });
  await auto.waitForTimeout(1200);
  eq('a reload does not re-import', (await board(auto)).length, 3);
  eq('and does not touch last_seen',
    (await board(auto)).map((r) => r.last_seen).sort(),
    beforeReload.map((r) => r.last_seen).sort());
  eq('the ledger still holds exactly one entry', (await seenDates(auto)).length, 1);

  /* Triage must survive an auto-import exactly as it survives a paste. */
  await auto.locator('.row').first().locator('summary').click();
  await auto.locator('.row').first().locator('[data-act="applied"]').click();
  await auto.waitForTimeout(80);
  const appliedId = (await board(auto)).find((r) => r.status === 'applied').id;
  await auto.reload({ waitUntil: 'domcontentloaded' });
  await auto.waitForTimeout(1200);
  eq('an applied status survives a reload with auto-import armed',
    (await board(auto)).find((r) => r.id === appliedId).status, 'applied');
  ok('and the applied role is not back in the daily list',
    !(await rowIds(auto)).includes(appliedId));

  /* A malformed index must leave the board usable. Offline, a missing file and
     a local file:// open all land here, and none of them is an error state. */
  await auto.goto(AUTO + '/?broken=1', { waitUntil: 'domcontentloaded' });
  await auto.route('**/data/digests/index.json*', (r) => r.fulfill({ body: 'not json' }));
  await auto.reload({ waitUntil: 'domcontentloaded' });
  await auto.waitForTimeout(1000);
  eq('a malformed index leaves the board intact', (await board(auto)).length, 3);
  ok('and the page still works', await auto.isVisible('.row'));
  await auto.close();
}

await browser.close();

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
