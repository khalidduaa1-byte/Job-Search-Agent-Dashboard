/* ------------------------------------------------------------------
   A whole week against the dashboard.

   check.mjs proves the merge rules on a two-day slice. This proves them
   over the shape the board is actually used in: the daily routine runs
   Monday to Thursday, the roundup runs Friday, and the one thing the
   owner has to be able to trust is that Tuesday adds to Monday rather
   than replacing it.

     python3 -m http.server 8040 &
     CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
       BASE=http://127.0.0.1:8040 node tests/week.mjs

   Same conventions as check.mjs: ok/eq, CHROME_PATH, importJSON through
   the real dialog, board() and rowIds() read the real store, non-zero
   exit on failure.

   Two things are different, and both matter.

   1. THE CLOCK. first_seen and last_seen come from todayISO(), which
      reads the real date, so a five-day simulation on one wall-clock
      day would stamp every row with the same date and the whole
      accumulation question would be untestable. Date is replaced in the
      page before the app boots, driven by a key in localStorage so the
      override survives a reload. The date it reports is asserted from a
      stamped first_seen, not assumed.

   2. THE DATA IS SYNTHETIC. Every company, role and URL below is
      invented for this test. Every URL is on a .test domain, which is
      reserved by RFC 2606 and cannot resolve. None of it is written to
      data/ or anywhere outside tests/, and none of it is a real
      posting.

   The overlap between the five days IS the test, so it is deliberate:
   Tuesday re-emits nine of Monday's ten (one of them from an aggregator
   under a different URL and a rewritten location, one of them
   rescored), Wednesday re-emits six and drops one that closed, and
   Thursday re-emits everything still live and finds nothing new.
------------------------------------------------------------------ */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8040';

let pass = 0;
const fails = [];
const notes = [];   /* observations, not failures */
const diary = [];   /* the per-day facts the report is written from */

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fails.push(name + (detail ? ` (${detail})` : '')); console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
/* For things that are worth stating in a report but are not a broken
   promise. Kept separate so a genuine regression cannot hide in here. */
function note(name, detail) {
  notes.push(name + (detail ? `: ${detail}` : ''));
  console.log(`  note  ${name}${detail ? ` (${detail})` : ''}`);
}

/* -- Plumbing, lifted from check.mjs ------------------------------- */
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

const listCompanies = (page) => page.$$eval('.row .row-co', (n) => n.map((x) => x.textContent));

const chip = (page) => page.evaluate(() => ({
  count: document.getElementById('latest-count').textContent,
  seen: document.getElementById('latest-seen').textContent
}));

const tiles = (page) => page.$$eval('.stat-n', (n) => n.map((x) => x.textContent));

const surface = async (page) => ({
  tiles: await tiles(page),
  count: (await page.textContent('#result-count')).trim(),
  latestDate: await page.textContent('#latest-date'),
  reportLabel: await page.textContent('#report-label'),
  lastUpdated: await page.textContent('#last-updated'),
  chip: await chip(page),
  best: await page.textContent('#best-company'),
  bestMeta: await page.textContent('#best-meta')
});

/* -- The clock -----------------------------------------------------
   One init script, registered once, so repeated advances do not stack
   five copies of a Date shim on top of each other. It reads the day it
   should report out of localStorage, which means the override survives
   every reload for free and a new day is "write the key, reload".

   Noon local, not midnight UTC: todayISO() uses getFullYear/getMonth/
   getDate, which are local, so a UTC midnight would report the previous
   day anywhere west of Greenwich and the whole simulation would be off
   by one in a way that looks like an app bug. */
const CLOCK_KEY = '__jsd_test_today';

async function installClock(page) {
  await page.addInitScript((key) => {
    let iso = null;
    try { iso = localStorage.getItem(key); } catch (e) { iso = null; }
    if (!iso) return;
    const Real = Date;
    const fixed = new Real(iso + 'T09:41:00').getTime();
    /* A Proxy keeps every static (parse, UTC, the prototype chain,
       instanceof) pointing at the real Date, so only "what time is it"
       changes. now() has to be intercepted explicitly. */
    window.Date = new Proxy(Real, {
      construct(target, args) {
        return args.length ? new target(...args) : new target(fixed);
      },
      apply() { return new Real(fixed).toString(); },
      get(target, prop, recv) {
        if (prop === 'now') return () => fixed;
        return Reflect.get(target, prop, recv);
      }
    });
  }, CLOCK_KEY);
}

async function advanceTo(page, iso, label) {
  await page.evaluate(([k, d]) => localStorage.setItem(k, d), [CLOCK_KEY, iso]);
  await page.reload({ waitUntil: 'networkidle' });
  const reported = await page.evaluate(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  });
  eq(`${label}: the page clock reports ${iso}`, reported, iso);
  return reported;
}

/* -- The five days, all synthetic ---------------------------------
   Deliberately NOT the week the test happens to be run in. The first
   version of this file simulated the current week, and Monday's
   first_seen assertion passed whether or not the Date override had
   applied at all, because the fake Monday and the real today were the
   same string. A week that cannot be today is the only way that
   assertion means anything. Asserted below. */
const MON = '2026-09-07', TUE = '2026-09-08', WED = '2026-09-09',
      THU = '2026-09-10', FRI = '2026-09-11';
const WEEK = [MON, TUE, WED, THU, FRI];

/* Fields every synthetic posting shares, so the digests below only
   carry what is actually varying. */
function post(o) {
  return Object.assign({
    remote: 'onsite', source: 'greenhouse', posted: '2026-09-01',
    signal: 'employer board page active', resume_tailored: false
  }, o);
}

const ARCLINE   = 'https://arcline-robotics.test/careers/ai-deployment-manager';
const BELLWETHER = 'https://bellwether-labs.test/jobs/tpm-ai';
const CINDERMILL = 'https://cindermill.test/roles/solutions-architect';
const DOVETAIL  = 'https://dovetail-systems.test/careers/fde';
const EVERLINE  = 'https://everline-health.test/jobs/ai-pm';
const FOXGLOVE  = 'https://foxglove-data.test/careers/se-llm';
const GRANTHAM  = 'https://grantham-freight.test/jobs/pm-automation';
const HALLOWAY  = 'https://halloway-retail.test/careers/pm-personalisation';
const IRONVALE  = 'https://ironvale-capital.test/jobs/ai-ops-lead';
const JUNIPER   = 'https://juniper-grid.test/roles/deployment-strategist';

const mon = {
  arcline: post({ title: 'AI Deployment Manager', company: 'Arcline Robotics',
    location: 'New York, NY', remote: 'hybrid', url: ARCLINE, score: 96,
    rationale: 'Owns rollout of a model platform into enterprise accounts, which is the shape of the last role almost exactly.' }),
  bellwether: post({ title: 'Technical Program Manager, AI', company: 'Bellwether Labs',
    location: 'New York, NY', url: BELLWETHER, score: 94,
    rationale: 'Cross functional AI programme work with named platform partners and a stated New York seat.' }),
  cindermill: post({ title: 'AI Solutions Architect', company: 'Cindermill AI',
    location: 'Remote - US', remote: 'remote', url: CINDERMILL, score: 92,
    rationale: 'Customer facing architecture on an LLM product, remote US, and the team is hiring three adjacent roles.' }),
  dovetail: post({ title: 'Forward Deployed Engineer', company: 'Dovetail Systems',
    location: 'New York, NY', remote: 'hybrid', url: DOVETAIL, score: 91,
    rationale: 'Deployment work with direct customer contact, which is the strongest overlap on the board this week.' }),
  everline: post({ title: 'AI Product Manager', company: 'Everline Health',
    location: 'New York, NY', remote: 'hybrid', url: EVERLINE, score: 88,
    rationale: 'Product ownership of a clinical AI feature. Regulated domain adds ramp, hence 88 rather than 92.' }),
  foxglove: post({ title: 'Solutions Engineer, LLM', company: 'Foxglove Data',
    location: 'Remote - US', remote: 'remote', url: FOXGLOVE, score: 85,
    rationale: 'Pre sales leaning, which is a step sideways, but the platform and the customers are the right ones.' }),
  grantham: post({ title: 'Program Manager, Automation', company: 'Grantham Freight',
    location: 'Newark, NJ', url: GRANTHAM, score: 78,
    rationale: 'Automation programme in logistics. Adjacent rather than aligned, and the AI content is thin.' }),
  halloway: post({ title: 'Product Manager, Personalisation', company: 'Halloway Retail',
    location: 'New York, NY', remote: 'hybrid', url: HALLOWAY, score: 74,
    rationale: 'Recommendation surfaces in retail. Real ML, but consumer rather than enterprise deployment.' }),
  ironvale: post({ title: 'AI Operations Lead', company: 'Ironvale Capital',
    location: 'New York, NY', url: IRONVALE, score: 71,
    rationale: 'Internal tooling ops in finance. The title fits, the scope is narrower than it reads.' }),
  juniper: post({ title: 'Deployment Strategist', company: 'Juniper Grid',
    location: 'Remote - US', remote: 'remote', url: JUNIPER, score: 64,
    rationale: 'Posting is vague about whether this is technical or commercial, so scored down pending a second look.' })
};

const mondayDigest = [
  mon.arcline, mon.bellwether, mon.cindermill, mon.dovetail, mon.everline,
  mon.foxglove, mon.grantham, mon.halloway, mon.ironvale, mon.juniper
];

/* Tuesday. Nine of Monday's ten come back:
     - seven byte-for-byte,
     - Dovetail from an AGGREGATOR: different URL, and "New York, New
       York" instead of "New York, NY". This is the case that used to
       fork a row, and forking it is how an applied role gets back into
       the daily list.
     - Juniper RESCORED, 64 to 93, which crosses a band boundary, with a
       new rationale.
   Halloway is the one Monday posting Tuesday does not carry. Three are
   genuinely new. */
const tuesdayDigest = [
  mon.arcline, mon.bellwether, mon.cindermill, mon.everline,
  mon.foxglove, mon.grantham, mon.ironvale,
  post({ title: 'Forward Deployed Engineer', company: 'Dovetail Systems',
    location: 'New York, New York', remote: 'hybrid', source: 'linkedin',
    url: 'https://ny-aggregator.test/listing/dovetail-forward-deployed-engineer',
    apply_url: 'https://ny-aggregator.test/listing/dovetail-forward-deployed-engineer/apply',
    score: 91,
    rationale: 'Deployment work with direct customer contact, which is the strongest overlap on the board this week.',
    signal: 'aggregator listing' }),
  post({ title: 'Deployment Strategist', company: 'Juniper Grid',
    location: 'Remote - US', remote: 'remote', url: JUNIPER, score: 93,
    rationale: 'Rescored. The team page names the platform and the role is technical after all, so this is a strong match, not a vague one.' }),
  post({ title: 'AI Program Manager', company: 'Kestrel Analytics',
    location: 'New York, NY', remote: 'hybrid',
    url: 'https://kestrel-analytics.test/jobs/ai-program-manager', score: 95,
    rationale: 'Programme ownership across three model teams, New York seat, and the scope is written in deployment terms.' }),
  post({ title: 'Technical PM, ML Platform', company: 'Larkspur Media',
    location: 'Remote - US', remote: 'remote',
    url: 'https://larkspur-media.test/careers/tpm-ml', score: 82,
    rationale: 'Platform PM work, but the AI surface is internal tooling rather than a customer product.' }),
  post({ title: 'AI Governance Manager', company: 'Mosswood Bank',
    location: 'New York, NY', url: 'https://mosswood-bank.test/jobs/ai-governance', score: 69,
    rationale: 'Policy and risk rather than build and ship. Listed for completeness, not recommended.' })
];

/* Wednesday. Six of the existing come back, Dovetail from the EMPLOYER
   URL again (the aggregator variant must not have permanently forked
   its identity), two are new, and Everline Health has gone: it closed.
   Everline is already applied, so absence deleting it would lose real
   triage, not just a row. */
const wednesdayDigest = [
  mon.arcline, mon.bellwether, mon.cindermill, mon.dovetail,
  post({ title: 'Deployment Strategist', company: 'Juniper Grid',
    location: 'Remote - US', remote: 'remote', url: JUNIPER, score: 93,
    rationale: 'Rescored. The team page names the platform and the role is technical after all, so this is a strong match, not a vague one.' }),
  post({ title: 'AI Program Manager', company: 'Kestrel Analytics',
    location: 'New York, NY', remote: 'hybrid',
    url: 'https://kestrel-analytics.test/jobs/ai-program-manager', score: 95,
    rationale: 'Programme ownership across three model teams, New York seat, and the scope is written in deployment terms.' }),
  post({ title: 'Deployment Manager, AI', company: 'Nightjar Energy',
    location: 'New York, NY', remote: 'hybrid',
    url: 'https://nightjar-energy.test/careers/deployment-manager-ai', score: 90,
    rationale: 'Grid operator standing up a deployment function from scratch, which is greenfield ownership.' }),
  post({ title: 'AI Product Lead', company: 'Oakhurst Legal',
    location: 'New York, NY', url: 'https://oakhurst-legal.test/jobs/ai-product-lead', score: 76,
    rationale: 'Legal tech AI product. Domain ramp is steep and the team is two people.' })
];

const CLOSED_WED = 'Everline Health';   /* on Monday and Tuesday, gone from Wednesday */
const NEVER_AGAIN = [CLOSED_WED, 'Grantham Freight'];  /* neither comes back Thursday */

/* -- Human state the imports must not touch ----------------------
   Seeded with the defaults for every row as it arrives, so an import
   writing status onto an UNTRIAGED row fails here too, not only on the
   four rows that were actually triaged. */
const human = {};
const firstSeen = {};

function arrives(companies, day) {
  companies.forEach((c) => {
    if (!(c in human)) human[c] = { status: 'new', hidden: false, notes: '' };
    if (!(c in firstSeen)) firstSeen[c] = day;
  });
}
function triaged(company, patch) { Object.assign(human[company], patch); }

function checkNoOverwrite(rows, label) {
  const bad = [];
  Object.keys(human).forEach((co) => {
    const r = rows.find((x) => x.company === co);
    if (!r) { bad.push(`${co} is no longer on the board`); return; }
    ['status', 'hidden', 'notes'].forEach((f) => {
      if (r[f] !== human[co][f]) {
        bad.push(`${co}.${f} = ${JSON.stringify(r[f])}, want ${JSON.stringify(human[co][f])}`);
      }
    });
  });
  ok(`${label}: every status, hidden and notes value the human set is unchanged`,
    bad.length === 0, bad.join(' | '));
}

/* Accumulation, stated the hard way: a row the digest never mentioned
   must come out of the merge byte for byte identical. Weaker checks pass
   while last_seen quietly creeps forward on rows that were not in the
   payload, which is the failure that makes Thursday look like a fresh
   report of everything. */
function checkUntouched(before, after, digest, label) {
  const mentioned = digest.map((r) => r.company);
  const bad = [];
  before.forEach((b) => {
    if (mentioned.indexOf(b.company) !== -1) return;
    const a = after.find((x) => x.id === b.id);
    if (!a) { bad.push(`${b.company} vanished`); return; }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      bad.push(`${b.company} changed: ${JSON.stringify(b)} -> ${JSON.stringify(a)}`);
    }
  });
  ok(`${label}: rows the digest never mentioned came out byte for byte identical`,
    bad.length === 0, bad.join(' | '));
}

function checkFirstSeen(rows, label) {
  const bad = [];
  Object.keys(firstSeen).forEach((co) => {
    const r = rows.find((x) => x.company === co);
    if (!r) { bad.push(`${co} missing`); return; }
    if (r.first_seen !== firstSeen[co]) {
      bad.push(`${co}.first_seen = ${r.first_seen}, want ${firstSeen[co]}`);
    }
  });
  ok(`${label}: first_seen still holds the day the row FIRST appeared`,
    bad.length === 0, bad.join(' | '));
}

/* Nothing with a done status may appear in the daily list, on any day. */
async function checkDoneStaysOut(page, label) {
  const listed = await listCompanies(page);
  const done = Object.keys(human).filter((c) =>
    ['applied', 'interviewing', 'offer', 'closed'].indexOf(human[c].status) !== -1);
  const leaked = done.filter((c) => listed.indexOf(c) !== -1);
  ok(`${label}: no actioned role is back in the daily list`, leaked.length === 0,
    'leaked: ' + leaked.join(', '));
  return done;
}

/* BEST OPPORTUNITY TODAY is a recommendation, so it may never name
   something already actioned. Checked every day, because the day it
   breaks is the day the top of the board goes quiet. */
async function checkBestIsActionable(page, label) {
  const best = await page.textContent('#best-company');
  const meta = await page.textContent('#best-meta');
  const rec = human[best];
  ok(`${label}: best opportunity is not an actioned role`,
    !rec || ['applied', 'interviewing', 'offer', 'closed'].indexOf(rec.status) === -1,
    `names ${best}, status ${rec ? rec.status : 'n/a'}`);
  /* renderHeader falls back to the whole visible pool when everything in
     today's arrivals is actioned, and labels that with "already
     <status>". Seeing that label on a day there is something to action
     means the fallback fired when it should not have. */
  ok(`${label}: and it is not the all-actioned fallback wearing a recommendation's clothes`,
    !/already (applied|interviewing|offer|closed)/.test(meta), meta);
}

/* -- Triage helpers -----------------------------------------------
   Driven through the real controls. A row with a done status is not in
   the daily list, so reaching one means going through the status filter
   first, which is exactly the recovery path a human would use. */
async function rowFor(page, company) {
  const rec = (await board(page)).find((r) => r.company === company);
  if (!rec) throw new Error('no board row for ' + company);
  return rec;
}

async function reveal(page, company) {
  const rec = await rowFor(page, company);
  const sel = `.row[data-id="${rec.id}"]`;
  if (await page.locator(sel).count() === 0) {
    await page.selectOption('#f-status', rec.status);
    await page.waitForTimeout(60);
  }
  const loc = page.locator(sel);
  if (await loc.count() === 0) throw new Error('could not reveal ' + company);
  await loc.locator('summary').click();
  return { rec, loc };
}

async function done(page) {
  await page.click('#clear');
  await page.waitForTimeout(60);
}

async function setStatus(page, company, status) {
  const { loc } = await reveal(page, company);
  await loc.locator('[data-act="status"]').selectOption(status);
  await page.waitForTimeout(90);
  await done(page);
  triaged(company, { status });
}

async function markApplied(page, company) {
  const { loc } = await reveal(page, company);
  await loc.locator('[data-act="applied"]').click();
  await page.waitForTimeout(90);
  await done(page);
  triaged(company, { status: 'applied' });
}

async function setNotes(page, company, text) {
  const { loc } = await reveal(page, company);
  await loc.locator('[data-act="notes"]').fill(text);
  await loc.locator('[data-act="notes"]').blur();
  await page.waitForTimeout(90);
  await done(page);
  triaged(company, { notes: text });
}

async function hide(page, company) {
  const { loc } = await reveal(page, company);
  await loc.locator('[data-act="hide"]').click();
  await page.waitForTimeout(90);
  await done(page);
  triaged(company, { hidden: true });
}

/* -- Restart safety ----------------------------------------------- */
async function restart(page, label) {
  const before = await board(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(80);
  const after = await board(page);
  ok(`${label}: a reload loses nothing, byte for byte`,
    JSON.stringify(after) === JSON.stringify(before),
    `${before.length} rows before, ${after.length} after`);
  return after;
}

/* ================================================================ */
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
page.on('pageerror', (e) => { fails.push('uncaught page error: ' + e.message); });

/* index.html links two Google Fonts stylesheets. Nothing here measures
   type, and a simulated week reloads the page eleven times, so leaving
   them in means every waitUntil:'networkidle' sits on a timeout waiting
   for a font host and a thirty second run takes five minutes. Blocked
   rather than waited on: the board is meant to work with no network at
   all beyond the file it was served from. */
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());

await installClock(page);
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());

/* ================================================================
   MONDAY. Fresh board, ten synthetic postings.
================================================================ */
console.log('\nMonday, a fresh board');
/* Before touching the clock: prove the simulated week cannot collide
   with the real one, or every date assertion below is satisfiable by
   the override having silently done nothing. */
const realToday = await page.evaluate(() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
});
ok('the simulated week is not the real week, so the date assertions can fail',
  WEEK.indexOf(realToday) === -1, `real date is ${realToday}`);

await advanceTo(page, MON, 'Monday');
ok('the board starts empty', (await board(page)).length === 0);

const monReport = await importJSON(page, mondayDigest);
arrives(Object.values(mon).map((r) => r.company), MON);
ok('Monday imports ten and rejects nothing', /10 added, 0 updated, 0 rejected/.test(monReport), monReport);
ok('Monday raises no off-spec warning', !/which is yours to set/.test(monReport));
await page.waitForSelector('.row');

let rows = await board(page);
eq('board size after Monday', rows.length, 10);

/* The clock override has to be proved from a STAMPED value, not from
   what the page says the date is. If addInitScript had silently not
   applied, everything below would still pass with today's real date and
   the accumulation question would go untested. */
eq('first_seen was stamped from the overridden clock, not the real date',
  rows.find((r) => r.company === 'Arcline Robotics').first_seen, MON);
ok('every Monday row is stamped Monday',
  rows.every((r) => r.first_seen === MON && r.last_seen === MON));

let s = await surface(page);
eq('Monday tiles: in view, 90 plus, applied, in progress', s.tiles, ['10', '4', '0', '0']);
eq('Monday result count', s.count, '10 to action');
eq('Monday latest report date', s.latestDate, 'September 7, 2026');
eq('Monday report label', s.reportLabel, 'DAILY OPPORTUNITY REPORT / SEPTEMBER 7, 2026');
eq('Monday chip: ten arrived, nothing to disambiguate', s.chip, { count: '10', seen: '' });
eq('Monday best opportunity is the top score', s.best, 'Arcline Robotics');

/* Triage: two applied, notes on one of them, and notes on the row that
   is about to be rescored, because a rescore is the import most likely
   to trample a note. */
await markApplied(page, 'Arcline Robotics');
await markApplied(page, CLOSED_WED);
await setNotes(page, CLOSED_WED, 'Recruiter screen booked for Thursday, 11am. Ask about the regulated-domain ramp.');
await setNotes(page, 'Juniper Grid', 'Posting is vague. Emailed the hiring manager on LinkedIn to ask if this is technical.');

rows = await board(page);
checkNoOverwrite(rows, 'Monday after triage');
checkFirstSeen(rows, 'Monday after triage');
await checkDoneStaysOut(page, 'Monday after triage');
await checkBestIsActionable(page, 'Monday after triage');

s = await surface(page);
eq('Monday tiles after two applied', s.tiles, ['10', '4', '2', '2']);
eq('Monday result count after two applied', s.count, '8 to action, 2 already in your pipeline');
eq('Monday best opportunity skips the applied top score', s.best, 'Bellwether Labs');
diary.push({ day: 'Mon ' + MON, size: 10, added: 10, chip: s.chip, tiles: s.tiles,
  count: s.count, latest: s.latestDate, best: s.best });

/* ================================================================
   TUESDAY. Nine of Monday's ten come back, one from an aggregator, one
   rescored. Three genuinely new.
================================================================ */
console.log('\nTuesday, nine re-emitted and three new');
await advanceTo(page, TUE, 'Tuesday');
rows = await board(page);
checkNoOverwrite(rows, 'Tuesday before import');
checkFirstSeen(rows, 'Tuesday before import');

const monArcId = rows.find((r) => r.company === 'Arcline Robotics').id;
const monDovetail = rows.find((r) => r.company === 'Dovetail Systems');
const beforeTue = rows;

const tueReport = await importJSON(page, tuesdayDigest);
arrives(['Kestrel Analytics', 'Larkspur Media', 'Mosswood Bank'], TUE);
ok('Tuesday is three added and nine updated, not twelve added',
  /3 added, 9 updated, 0 rejected/.test(tueReport), tueReport);
ok('Tuesday says the updated rows kept their triage',
  /kept their status/.test(tueReport), tueReport);
ok('Tuesday raises no off-spec warning', !/which is yours to set/.test(tueReport));

rows = await board(page);
eq('board size after Tuesday: ten plus the three that are actually new', rows.length, 13);
checkNoOverwrite(rows, 'Tuesday');
checkFirstSeen(rows, 'Tuesday');
checkUntouched(beforeTue, rows, tuesdayDigest, 'Tuesday');
await checkDoneStaysOut(page, 'Tuesday');
await checkBestIsActionable(page, 'Tuesday');

/* 4. The rescore. Agent-owned fields refresh, including across a band
   boundary. Human-owned fields and first_seen do not move. */
const juniper = rows.find((r) => r.company === 'Juniper Grid');
eq('the rescored row took the new score', juniper.score, 93);
eq('and the band was recomputed, weak to strong', juniper.band, 'strong');
ok('and the rationale was replaced', /Rescored\./.test(juniper.rationale), juniper.rationale);
eq('while its first_seen still says Monday', juniper.first_seen, MON);
eq('and its last_seen says Tuesday', juniper.last_seen, TUE);
ok('and the note the human wrote is untouched',
  /Emailed the hiring manager/.test(juniper.notes), juniper.notes);
eq('and its status was not reset', juniper.status, 'new');

/* 5. The aggregator variant. Different URL, rewritten location, same
   job. Update, not add, and the row keeps its identity. */
const dovetails = rows.filter((r) => r.company === 'Dovetail Systems');
eq('the aggregator variant did not fork a second Dovetail row', dovetails.length, 1);
eq('the row kept its id, so nothing downstream sees a new opportunity',
  dovetails[0].id, monDovetail.id);
eq('its first_seen is still Monday, not Tuesday', dovetails[0].first_seen, MON);
eq('the rewritten location was accepted as the fresher fact',
  dovetails[0].location, 'New York, New York');
ok('and so was the aggregator URL', /ny-aggregator\.test/.test(dovetails[0].url), dovetails[0].url);

/* 3. Applied roles stay out even when the digest re-emits them. */
eq('Arcline was re-emitted and is still applied',
  rows.find((r) => r.id === monArcId).status, 'applied');
ok('the daily list did not regain an applied role',
  !(await rowIds(page)).includes(monArcId));

/* Halloway was NOT in Tuesday's digest, so its last_seen must not move. */
eq('a posting missing from Tuesday keeps Monday as its last_seen',
  rows.find((r) => r.company === 'Halloway Retail').last_seen, MON);

s = await surface(page);
eq('Tuesday tiles', s.tiles, ['13', '6', '2', '2']);
eq('Tuesday result count', s.count, '11 to action, 2 already in your pipeline');
eq('Tuesday latest report date', s.latestDate, 'September 8, 2026');
eq('Tuesday chip separates what arrived from what was re-seen',
  s.chip, { count: '3', seen: ' new, 9 still live' });

/* Restart in the middle of the week. */
rows = await restart(page, 'Tuesday');
checkNoOverwrite(rows, 'Tuesday after a reload');
checkFirstSeen(rows, 'Tuesday after a reload');
eq('the clock survived the reload too',
  (await page.textContent('#latest-date')), 'September 8, 2026');

/* Triage: hide one, one to interviewing. */
await hide(page, 'Halloway Retail');
await setStatus(page, 'Bellwether Labs', 'interviewing');

rows = await board(page);
checkNoOverwrite(rows, 'Tuesday after triage');
checkFirstSeen(rows, 'Tuesday after triage');
eq('hiding deleted nothing', rows.length, 13);
await checkDoneStaysOut(page, 'Tuesday after triage');
await checkBestIsActionable(page, 'Tuesday after triage');

s = await surface(page);
eq('Tuesday tiles after triage', s.tiles, ['12', '6', '3', '3']);
eq('Tuesday result count after triage', s.count, '9 to action, 3 already in your pipeline');
eq('Tuesday chip after triage', s.chip, { count: '3', seen: ' new, 9 still live' });
diary.push({ day: 'Tue ' + TUE, size: 13, added: 3, chip: s.chip, tiles: s.tiles,
  count: s.count, latest: s.latestDate, best: s.best });

/* ================================================================
   WEDNESDAY. Six re-emitted, two new, and one Monday posting has
   closed. Absence must not delete.
================================================================ */
console.log('\nWednesday, six re-emitted, two new, one closed');
await advanceTo(page, WED, 'Wednesday');

const beforeWed = await board(page);
const closedBefore = beforeWed.find((r) => r.company === CLOSED_WED);
const wedReport = await importJSON(page, wednesdayDigest);
arrives(['Nightjar Energy', 'Oakhurst Legal'], WED);
ok('Wednesday is two added and six updated', /2 added, 6 updated, 0 rejected/.test(wedReport), wedReport);

rows = await board(page);
eq('board size after Wednesday', rows.length, 15);
checkNoOverwrite(rows, 'Wednesday');
checkFirstSeen(rows, 'Wednesday');
checkUntouched(beforeWed, rows, wednesdayDigest, 'Wednesday');
await checkDoneStaysOut(page, 'Wednesday');
await checkBestIsActionable(page, 'Wednesday');

/* 7. The dropped posting. */
const closedAfter = rows.find((r) => r.company === CLOSED_WED);
ok('a posting absent from the digest is still on the board', !!closedAfter);
eq('and it kept the applied status the human set', closedAfter.status, 'applied');
eq('and it kept its notes', closedAfter.notes, closedBefore.notes);
eq('and its last_seen still says Tuesday, which is how she can tell it went quiet',
  closedAfter.last_seen, TUE);
eq('and its first_seen still says Monday', closedAfter.first_seen, MON);

/* The employer URL came back after the aggregator rewrote it. Still one row. */
eq('Dovetail flipping back to the employer URL did not fork it either',
  rows.filter((r) => r.company === 'Dovetail Systems').length, 1);
eq('and it is the same row throughout',
  rows.find((r) => r.company === 'Dovetail Systems').id, monDovetail.id);

s = await surface(page);
eq('Wednesday tiles', s.tiles, ['14', '7', '3', '3']);
eq('Wednesday result count', s.count, '11 to action, 3 already in your pipeline');
eq('Wednesday latest report date', s.latestDate, 'September 9, 2026');
eq('Wednesday chip', s.chip, { count: '2', seen: ' new, 6 still live' });

/* Triage: one to saved, and an applied role moves to offer. Reaching
   the applied one means going through the pipeline filter, which is the
   recovery path rule 2 depends on being real. */
await setStatus(page, 'Cindermill AI', 'saved');
await setStatus(page, 'Arcline Robotics', 'offer');

rows = await board(page);
checkNoOverwrite(rows, 'Wednesday after triage');
checkFirstSeen(rows, 'Wednesday after triage');
await checkDoneStaysOut(page, 'Wednesday after triage');
await checkBestIsActionable(page, 'Wednesday after triage');
s = await surface(page);
eq('Wednesday tiles after triage', s.tiles, ['14', '7', '3', '4']);
eq('Wednesday result count after triage', s.count, '11 to action, 3 already in your pipeline');
diary.push({ day: 'Wed ' + WED, size: 15, added: 2, chip: s.chip, tiles: s.tiles,
  count: s.count, latest: s.latestDate, best: s.best });

/* ================================================================
   THURSDAY. Everything still live comes back. Nothing is new. This is
   the day the board's story is easiest to get wrong: bump last_seen on
   fifteen rows and the header can read as though fifteen roles arrived
   this morning.
================================================================ */
console.log('\nThursday, everything re-emitted and nothing new');
await advanceTo(page, THU, 'Thursday');

/* Built from the board, which is what the agent would emit: every live
   posting, with the agent-owned fields only. The two that closed are
   left out. */
const beforeThu = await board(page);
const live = beforeThu.filter((r) => NEVER_AGAIN.indexOf(r.company) === -1);
const thursdayDigest = live.map((r) => ({
  title: r.title, company: r.company, location: r.location, remote: r.remote,
  source: r.source, url: r.url, apply_url: r.apply_url, posted: r.posted,
  score: r.score, rationale: r.rationale, signal: r.signal,
  resume_tailored: r.resume_tailored
}));
/* One extra turn of the screw: the role she now has an OFFER on comes
   back from an aggregator, under a new URL and a third spelling of the
   same city. If dedup forks here, an offer lands back in the daily list
   at status new, which is the worst single failure this board has. */
const arcAgg = thursdayDigest.find((r) => r.company === 'Arcline Robotics');
arcAgg.url = 'https://ny-aggregator.test/listing/arcline-ai-deployment-manager';
arcAgg.apply_url = arcAgg.url + '/apply';
arcAgg.location = 'New York, New York (Hybrid)';
arcAgg.source = 'linkedin';
eq('Thursday re-emits every live posting and nothing else', thursdayDigest.length, 13);

const thuReport = await importJSON(page, thursdayDigest);
ok('Thursday adds nothing', /0 added, 13 updated, 0 rejected/.test(thuReport), thuReport);

rows = await board(page);
eq('board size after Thursday is unchanged', rows.length, 15);
checkNoOverwrite(rows, 'Thursday');
checkFirstSeen(rows, 'Thursday');
checkUntouched(beforeThu, rows, thursdayDigest, 'Thursday');
await checkDoneStaysOut(page, 'Thursday');
await checkBestIsActionable(page, 'Thursday');

eq('the offer role survived an aggregator re-emission',
  rows.filter((r) => r.company === 'Arcline Robotics').length, 1);
eq('and it is still an offer, not a new opportunity',
  rows.find((r) => r.company === 'Arcline Robotics').status, 'offer');
eq('the hidden row was re-emitted and stayed hidden',
  rows.find((r) => r.company === 'Halloway Retail').hidden, true);
eq('and it caught up to Thursday, so absence and hiding are not confused',
  rows.find((r) => r.company === 'Halloway Retail').last_seen, THU);

/* 6. The important one. A morning that found nothing must not read as a
   fresh report of the whole board. */
s = await surface(page);
eq('Thursday chip reports zero arrivals and the re-seen count separately',
  s.chip, { count: '12', seen: ' still live, nothing new' });
eq('Thursday latest report date', s.latestDate, 'September 10, 2026');
eq('Thursday tiles', s.tiles, ['14', '7', '3', '4']);
eq('Thursday result count', s.count, '11 to action, 3 already in your pipeline');
eq('Thursday best opportunity', s.best, 'Kestrel Analytics');
note('the Thursday chip renders as', `"${s.chip.count} JOBS${s.chip.seen}"`);

rows = await restart(page, 'Thursday');
checkNoOverwrite(rows, 'Thursday after a reload');
checkFirstSeen(rows, 'Thursday after a reload');
eq('the chip still reads the same after a restart', await chip(page),
  { count: '12', seen: ' still live, nothing new' });

await setNotes(page, 'Kestrel Analytics',
  'Second read: the scope is deployment, not delivery. Worth tailoring the resume for this one.');
rows = await board(page);
checkNoOverwrite(rows, 'Thursday after triage');
checkFirstSeen(rows, 'Thursday after triage');
s = await surface(page);
diary.push({ day: 'Thu ' + THU, size: 15, added: 0, chip: s.chip, tiles: s.tiles,
  count: s.count, latest: s.latestDate, best: s.best });

/* ================================================================
   FRIDAY. No import at all. Export the board and check the roundup
   could actually run off it.
================================================================ */
console.log('\nFriday, no import, the roundup handoff');
await advanceTo(page, FRI, 'Friday');

rows = await board(page);
eq('Friday board size, nothing arrived and nothing left', rows.length, 15);
checkNoOverwrite(rows, 'Friday');
checkFirstSeen(rows, 'Friday');
await checkDoneStaysOut(page, 'Friday');
await checkBestIsActionable(page, 'Friday');

s = await surface(page);
eq('Friday latest report still points at Thursday, because Friday has no report',
  s.latestDate, 'September 10, 2026');
eq('Friday report label', s.reportLabel, 'DAILY OPPORTUNITY REPORT / SEPTEMBER 10, 2026');
eq('Friday chip is Thursday\'s, unchanged', s.chip, { count: '12', seen: ' still live, nothing new' });
eq('Friday tiles', s.tiles, ['14', '7', '3', '4']);
eq('Friday result count', s.count, '11 to action, 3 already in your pipeline');
eq('last updated is the last day anything actually changed', s.lastUpdated, 'September 10, 2026');
diary.push({ day: 'Fri ' + FRI, size: 15, added: 0, chip: s.chip, tiles: s.tiles,
  count: s.count, latest: s.latestDate, best: s.best });

/* -- The export --------------------------------------------------- */
const dl = await Promise.all([page.waitForEvent('download'), page.click('#export')]).then((r) => r[0]);
eq('the export filename carries Friday\'s date', dl.suggestedFilename(), 'jsd-board-2026-09-11.json');
const exportedFile = JSON.parse(readFileSync(await dl.path(), 'utf8'));

/* The export is wrapped now, with its generation date inside the file.
   weekly-roundup.md requires the roundup to state when its input was taken, and
   the filename does not survive the paste the prompt actually asks for. */
eq('the export states when it was generated, inside the file itself',
  exportedFile.exported, '2026-09-11');
const exported = exportedFile.items;

eq('the export is the whole week, hidden and closed rows included', exported.length, 15);
ok('including the hidden row', exported.some((r) => r.company === 'Halloway Retail' && r.hidden === true));
ok('including the two that stopped being re-emitted',
  NEVER_AGAIN.every((c) => exported.some((r) => r.company === c)));

/* 9. Everything below is computed from `exported` ALONE, with no access
   to the page, because that is all the Friday task gets. */
const need = ['company', 'title', 'location', 'score', 'status', 'hidden',
              'first_seen', 'last_seen', 'url'];
const missing = need.filter((f) => !exported.every((r) => f in r));
eq('the export carries every field the roundup reads', missing, []);

/* weekly-roundup.md section 3: score >= 90, status new or saved, hidden false. */
const section3 = exported
  .filter((r) => r.score >= 90 && (r.status === 'new' || r.status === 'saved') && r.hidden === false)
  .sort((a, b) => b.score - a.score);
eq('section 3 is derivable from the export alone',
  section3.map((r) => r.score + ' ' + r.company),
  ['95 Kestrel Analytics', '93 Juniper Grid', '92 Cindermill AI',
   '91 Dovetail Systems', '90 Nightjar Energy']);
ok('and every section 3 row has a link to re-open',
  section3.every((r) => /^https:\/\//.test(r.url)));
ok('the offer, the interviewing and the applied roles are correctly absent from section 3',
  !section3.some((r) => ['Arcline Robotics', 'Bellwether Labs', CLOSED_WED].includes(r.company)));
ok('and so is the hidden one',
  !section3.some((r) => r.company === 'Halloway Retail'));
ok('the saved role IS in section 3, because saved is not actioned',
  section3.some((r) => r.company === 'Cindermill AI'));

/* Section 2: top five by score, with links. */
const top5 = exported.slice().sort((a, b) => b.score - a.score).slice(0, 5);
eq('the top five by score is derivable from the export alone',
  top5.map((r) => r.score + ' ' + r.company),
  ['96 Arcline Robotics', '95 Kestrel Analytics', '94 Bellwether Labs',
   '93 Juniper Grid', '92 Cindermill AI']);
ok('and each has a URL step 2 can re-open', top5.every((r) => /^https:\/\//.test(r.url)));

/* "This week means first_seen within the last seven days." */
const thisWeek = exported.filter((r) => r.first_seen >= MON && r.first_seen <= FRI);
eq('the whole week is inside the seven day window', thisWeek.length, 15);
eq('and first_seen distinguishes Monday, Tuesday and Wednesday arrivals',
  [MON, TUE, WED].map((d) => exported.filter((r) => r.first_seen === d).length),
  [10, 3, 2]);

/* The one thing the export cannot answer. weekly-roundup.md section 3
   asks for "Say when the input was generated, because a three-day-old
   export is three days of triage out of date." The array carries no
   such stamp: it is a bare array of rows, and the only date is in the
   FILENAME, which is lost the moment she pastes rather than attaches,
   which is what the prompt tells her to do first. Not a failure of an
   assertion the app makes, so it is recorded as an observation and
   written up rather than failing the run. */
const stamped = !Array.isArray(exported) ||
  exported.some((r) => 'exported_at' in r || 'generated' in r);
note('the export body carries no generated-at stamp',
  stamped ? 'it does after all' :
  'bare array, date is only in the filename jsd-board-2026-09-11.json, ' +
  'so a pasted export cannot answer "when was this generated"');
const maxSeen = exported.reduce((a, r) => (r.last_seen > a ? r.last_seen : a), '');
note('the closest a pasted export gets to its own age',
  `max(last_seen) = ${maxSeen}, which is Thursday, not Friday, and does not move when she triages`);

/* -- The agent brief --------------------------------------------- */
console.log('\nThe agent brief after four days of triage');
await page.evaluate(() => { if (navigator.clipboard) navigator.clipboard.writeText = undefined; });
const briefDl = await Promise.all([page.waitForEvent('download'), page.click('#brief')]).then((r) => r[0]);
const brief = readFileSync(await briefDl.path(), 'utf8');
eq('the brief is dated Friday', briefDl.suggestedFilename(), 'agent-brief-2026-09-11.md');

const skipBlock = brief.split('## Scored 90 plus')[0];
const strongBlock = brief.split('## Scored 90 plus')[1];
const skipLines = skipBlock.split('\n').filter((l) => l.startsWith('- '));

/* Every row that is actioned or hidden, and nothing else. */
const shouldSkip = Object.keys(human).filter((c) =>
  human[c].hidden || ['applied', 'interviewing', 'offer', 'closed'].indexOf(human[c].status) !== -1);
eq('the skip list is exactly the actioned and hidden rows, after four days',
  skipLines.length, shouldSkip.length);
const notNamed = shouldSkip.filter((c) => skipLines.every((l) => l.indexOf(c) === -1));
eq('and every one of them is named', notNamed, []);
ok('every skip line carries a URL, which is the only thing an aggregator cannot mangle',
  skipLines.every((l) => /\| https:\/\//.test(l)), skipLines.join(' // '));
ok('the offer role is on the skip list', /Arcline Robotics \|.*\| offer \|/.test(skipBlock), skipBlock);
ok('the interviewing role is on the skip list', /Bellwether Labs \|.*\| interviewing \|/.test(skipBlock));
ok('the applied role that closed is still on the skip list',
  new RegExp(CLOSED_WED + ' \\|.*\\| applied \\|').test(skipBlock));
ok('the hidden role is on the skip list', /Halloway Retail \|.*\| hidden \|/.test(skipBlock));
ok('the saved role is NOT on the skip list, because it is still worth re-emitting',
  skipBlock.indexOf('Cindermill AI') === -1);
ok('nor is anything still untouched', skipBlock.indexOf('Kestrel Analytics') === -1);

/* And the brief's own 90-plus section has to agree with what the export
   says section 3 is, or the two documented inputs to the same section
   of the roundup disagree with each other. */
const briefStrong = strongBlock.split('\n').filter((l) => l.startsWith('- '))
  .map((l) => l.replace(/^- /, '').split(' | ').slice(0, 2).join(' '));
eq('the brief\'s 90-plus list matches section 3 computed from the export',
  briefStrong, section3.map((r) => r.score + ' ' + r.company));
ok('the brief carries first_seen, so a role sitting untouched for a week is visible',
  new RegExp('first seen ' + MON).test(strongBlock), strongBlock);

/* -- One last restart, on Friday, after everything --------------- */
console.log('\nRestart safety, at the end of the week');
rows = await restart(page, 'Friday');
checkNoOverwrite(rows, 'Friday after a reload');
checkFirstSeen(rows, 'Friday after a reload');
eq('all fifteen rows are still there after five days and four reloads', rows.length, 15);
eq('and the notes written on four different days all survived',
  rows.filter((r) => r.notes).map((r) => r.company).sort(),
  ['Everline Health', 'Juniper Grid', 'Kestrel Analytics']);
eq('and the statuses set on three different days all survived',
  rows.filter((r) => r.status !== 'new').map((r) => r.company + '=' + r.status).sort(),
  ['Arcline Robotics=offer', 'Bellwether Labs=interviewing',
   'Cindermill AI=saved', 'Everline Health=applied']);

/* ================================================================
   ADVERSARIAL PROBES

   Everything above passed on the first run, which is not evidence that
   the merge is sound, only that the week above did not reach the places
   it breaks. These two do. They run on a throwaway board so they cannot
   perturb any assertion above, and where the current behaviour is wrong
   rather than merely surprising they record a note and the report says
   so, because this file must not assert that a defect is correct.
================================================================ */
console.log('\nAdversarial probes, on a throwaway board');
async function freshBoard(page, day) {
  await page.evaluate(() => localStorage.removeItem('jsd.board.v1'));
  await page.evaluate(([k, d]) => localStorage.setItem(k, d), [CLOCK_KEY, day]);
  await page.reload({ waitUntil: 'networkidle' });
}

/* Probe 1. The aggregator rewrites the URL AND the title.

   dedupKey is the canonical URL, and keysOf falls back to company plus
   title. app.js says the identity key exists because "the same posting
   reaches us from two boards under two different titles" (app.js:71-73)
   and the agent brief it generates warns the agent that "an aggregator
   will change the title and the location for the same job"
   (app.js:648-649). If both statements are true then company plus title
   cannot be the fallback key, because a rewritten title changes it. The
   week above only ever rewrote the location, which is why it passed. */
await freshBoard(page, MON);
const employer = post({
  title: 'AI Deployment Manager', company: 'Vantage Rail', location: 'New York, NY',
  remote: 'hybrid', url: 'https://vantage-rail.test/careers/ai-deployment-manager', score: 95,
  rationale: 'One synthetic posting, used to probe what the dedup key does when a job board rewrites the title.'
});
await importJSON(page, [employer]);
await page.waitForSelector('.row');
human['Vantage Rail'] = { status: 'new', hidden: false, notes: '' };
await markApplied(page, 'Vantage Rail');
delete human['Vantage Rail'];  /* probe-local, not part of the week's ledger */
eq('probe 1: the role is applied and out of the daily list', await rowIds(page), []);

await advanceTo(page, TUE, 'probe 1');
const retitled = Object.assign({}, employer, {
  title: 'AI Deployment Manager - New York (Hybrid)',
  location: 'New York, New York',
  source: 'linkedin',
  url: 'https://ny-aggregator.test/listing/vantage-rail-ai-deployment-manager',
  apply_url: 'https://ny-aggregator.test/listing/vantage-rail-ai-deployment-manager/apply'
});
const probe1 = await importJSON(page, [retitled]);
const p1rows = await board(page);
const p1listed = await listCompanies(page);
const forked = p1rows.length === 2;
note('probe 1, aggregator rewrites URL and title',
  forked
    ? 'FORKS. ' + probe1.trim().split('\n')[0] +
      ' The applied role is back on the board as a second row at status new' +
      (p1listed.length ? ', and it is in the daily list' : '') +
      '. Rule 2 is defeated by a title rewrite, which app.js:648 says aggregators do.'
    : 'deduped correctly, one row, status ' + p1rows[0].status);
ok('probe 1: whatever the key does, the applied row itself was not overwritten',
  p1rows.some((r) => r.status === 'applied'),
  JSON.stringify(p1rows.map((r) => r.company + '=' + r.status)));

/* Probe 2. The only thing that arrived today gets hidden.

   latestDate() and the arrived/still-live split are both computed over
   visible() (app.js:299-303, 360-365), so hiding today's only arrival
   makes the header describe a different day. Worth knowing whether
   LATEST REPORT can travel backwards, because the whole point of the
   chip work was that the header never lies about what day it is
   describing. */
await freshBoard(page, MON);
await importJSON(page, [post({ title: 'Probe Role A', company: 'Alder Freight',
  location: 'New York, NY', url: 'https://alder-freight.test/jobs/a', score: 80,
  rationale: 'Synthetic probe row, day one.' })]);
await advanceTo(page, TUE, 'probe 2');
await importJSON(page, [post({ title: 'Probe Role B', company: 'Birch Analytics',
  location: 'New York, NY', url: 'https://birch-analytics.test/jobs/b', score: 84,
  rationale: 'Synthetic probe row, day two, the only arrival.' })]);
await page.waitForSelector('.row');
eq('probe 2: with both visible the header describes Tuesday',
  await page.textContent('#latest-date'), 'September 8, 2026');
human['Birch Analytics'] = { status: 'new', hidden: false, notes: '' };
await hide(page, 'Birch Analytics');
delete human['Birch Analytics'];
const p2date = await page.textContent('#latest-date');
const p2chip = await chip(page);
const p2updated = await page.textContent('#last-updated');
note('probe 2, today\'s only arrival is hidden',
  `LATEST REPORT reads "${p2date}", the chip reads "${p2chip.count} JOBS${p2chip.seen}", ` +
  `and Last updated reads "${p2updated}"` +
  (p2date === 'September 8, 2026' ? '' :
   '. The header travels backwards to the previous day, and the two dates in the ' +
   'top bar and the results panel now disagree about what day it is'));
ok('probe 2: hiding still deleted nothing', (await board(page)).length === 2);

await browser.close();

/* -- The week, as a table ---------------------------------------- */
console.log('\nThe week');
console.log('  ' + 'day'.padEnd(16) + 'board'.padEnd(7) + 'arrived'.padEnd(9) +
  'chip'.padEnd(30) + 'tiles'.padEnd(22) + 'latest report');
diary.forEach((d) => {
  console.log('  ' + d.day.padEnd(16) + String(d.size).padEnd(7) + String(d.added).padEnd(9) +
    `"${d.chip.count} JOBS${d.chip.seen}"`.padEnd(30) +
    JSON.stringify(d.tiles).padEnd(22) + d.latest);
});

if (notes.length) {
  console.log('\nObservations, not failures');
  notes.forEach((n) => console.log('  - ' + n));
}

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
