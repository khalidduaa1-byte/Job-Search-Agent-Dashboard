/* ------------------------------------------------------------------
   Job Search Agent & Dashboard

   No dependencies, no build step. The board lives in localStorage and
   nowhere else.

   Field ownership and the merge policy are specified in CONTRACT.md.
   The short version: the agent owns the scoring fields, the human owns
   status, hidden and notes, and an import must never overwrite a
   decision the human already made.
------------------------------------------------------------------ */
(function () {
  'use strict';

  var KEY = 'jsd.board.v1';
  var STATUSES = ['new', 'saved', 'applied', 'interviewing', 'offer', 'closed'];
  var REMOTES = ['onsite', 'hybrid', 'remote', 'unknown'];
  var PIPELINE = ['saved', 'applied', 'interviewing', 'offer'];

  /* Once you have applied, the role is not something to action tomorrow
     morning, so it leaves the daily list and lives in the pipeline card
     instead. It is never deleted: pick the status in the filter, or click
     the pipeline row, and it comes straight back.

     This is what stops an applied role reappearing every morning. The agent
     re-emits the same posting on Tuesday, the merge keeps the status it
     already has, and a row with a DONE status is not listed. */
  var DONE = ['applied', 'interviewing', 'offer', 'closed'];

  /* State ---------------------------------------------------------- */
  var board = [];
  var meta = { updated: '' };
  var filters = { q: '', status: 'all', score: 'all' };

  /* Helpers -------------------------------------------------------- */
  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeUrl(u) {
    return /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
  }

  function prettyDate(iso) {
    if (!iso) return '';
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December'];
    var mi = parseInt(parts[1], 10) - 1;
    if (mi < 0 || mi > 11) return iso;
    return months[mi] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }

  /* Band is always derived from score, so the two can never disagree. */
  function bandOf(score) {
    if (score >= 90) return 'strong';
    if (score >= 70) return 'possible';
    return 'weak';
  }

  /* The dedup key. Canonical URL when we have one, because the same
     posting reaches us from two boards under two different titles.
     Otherwise fall back to the employer and role. */
  function urlKey(rec) {
    var u = safeUrl(rec.url);
    return u ? u.toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '') : '';
  }

  /* Company and title only. Location is deliberately NOT in this key.

     It used to be, and it made the key useless against a real aggregator: the
     same posting arrives as "New York, NY" from the employer board and
     "New York, New York" or "New York, NY (Hybrid)" from a job site, which are
     three different strings for one place. A role she had applied to came back
     as a fresh row at status new, which is the one thing rule 2 in CLAUDE.md
     exists to prevent.

     The tradeoff, stated so nobody re-adds it: two genuinely different roles
     with the same title at the same company in two different cities now merge
     into one row. That is rare, the search is New York and remote-US only, and
     showing one row instead of two is a far smaller failure than an applied
     role reappearing every morning. */
  function identityKey(rec) {
    return [rec.company, rec.title].map(function (p) {
      return String(p || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    }).join('|');
  }

  function dedupKey(rec) {
    return urlKey(rec) || identityKey(rec);
  }

  /* Both keys, so a row matches on either.

     The URL alone was not enough. The same posting reaches us from the employer
     board on Monday and from an aggregator on Tuesday under a different URL, and
     the agent has no memory of which board it used yesterday. With a URL-only
     key that imported as a second row at status new, which put a role she had
     already applied to straight back in the daily list and quietly defeated
     rule 2. Matching company plus title plus location as well closes it. */
  function keysOf(rec) {
    var out = [];
    var u = urlKey(rec);
    if (u) out.push(u);
    var i = identityKey(rec);
    if (i && i !== '|') out.push(i);
    return out;
  }

  function hashId(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return 'op_' + (h >>> 0).toString(36);
  }

  /* Persistence ---------------------------------------------------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && Array.isArray(raw.items)) {
        board = raw.items;
        meta.updated = raw.updated || '';
      }
    } catch (e) {
      board = [];
    }
  }

  function save() {
    meta.updated = todayISO();
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, updated: meta.updated, items: board }));
    } catch (e) {
      toast('Could not save to localStorage. Export to keep a copy.');
    }
  }

  /* Validation ----------------------------------------------------------
     Forgiving but loud. A row is rejected only when the board cannot
     function without the field. Everything else is coerced and reported,
     because losing a real opportunity to a missing enum would be worse
     than showing it with a default.
  --------------------------------------------------------------------- */
  function validate(raw) {
    var warnings = [];

    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, reason: 'not a JSON object' };
    }
    if (!raw.title || typeof raw.title !== 'string') {
      return { ok: false, reason: 'missing title' };
    }
    if (!raw.company || typeof raw.company !== 'string') {
      return { ok: false, reason: 'missing company' };
    }

    var score = Number(raw.score);
    if (!isFinite(score) || Math.floor(score) !== score || score < 0 || score > 100) {
      return { ok: false, reason: 'score must be an integer from 0 to 100, got ' + JSON.stringify(raw.score) };
    }

    if (raw.url && !safeUrl(raw.url)) {
      warnings.push('dropped a url that was not http or https');
    }

    var remote = REMOTES.indexOf(raw.remote) === -1 ? 'unknown' : raw.remote;
    if (raw.remote && remote !== raw.remote) {
      warnings.push('remote "' + raw.remote + '" is not a known value, set to unknown');
    }

    var band = bandOf(score);
    if (raw.band && raw.band !== band) {
      warnings.push('band "' + raw.band + '" disagrees with score ' + score + ', corrected to ' + band);
    }

    if (!raw.rationale) warnings.push('no rationale supplied');

    /* Warn loudly when the agent sends a human-owned field. The merge already
       ignores these for a row the board has seen, but for a NEW row they are
       read as defaults, so a digest carrying "hidden": true lands a strong role
       invisible and nothing said so. Both prompts forbid emitting these three,
       so their presence means the agent is off-spec and she should know. */
    ['status', 'hidden', 'notes'].forEach(function (f) {
      if (raw[f] !== undefined) {
        warnings.push('the digest carried "' + f + '", which is yours to set, not the agent\'s. ' +
                      'Ignored for a row already on the board, used as the starting value for a ' +
                      'new one, so check this row is where you expect it.');
      }
    });

    var rec = {
      title: String(raw.title).trim(),
      company: String(raw.company).trim(),
      location: String(raw.location || '').trim(),
      remote: remote,
      source: String(raw.source || 'unknown').trim(),
      url: safeUrl(raw.url),
      apply_url: safeUrl(raw.apply_url) || safeUrl(raw.url),
      posted: /^\d{4}-\d{2}-\d{2}$/.test(raw.posted) ? raw.posted : '',
      score: score,
      band: band,
      rationale: String(raw.rationale || '').trim(),
      signal: String(raw.signal || '').trim(),
      resume_tailored: raw.resume_tailored === true
    };

    /* Human-owned fields are only ever read as defaults for a record the
       board has not seen before. merge() enforces that. */
    rec._status = STATUSES.indexOf(raw.status) === -1 ? 'new' : raw.status;
    rec._hidden = raw.hidden === true;
    rec._notes = typeof raw.notes === 'string' ? raw.notes : '';

    return { ok: true, rec: rec, warnings: warnings };
  }

  /* Merge ---------------------------------------------------------- */
  function merge(rows) {
    var today = todayISO();
    var byKey = {};
    board.forEach(function (r, i) {
      keysOf(r).forEach(function (k) { byKey[k] = i; });
    });

    var added = 0, updated = 0, rejected = [], warnings = [];

    rows.forEach(function (raw, i) {
      var v = validate(raw);
      if (!v.ok) {
        rejected.push('row ' + (i + 1) + ': ' + v.reason);
        return;
      }
      v.warnings.forEach(function (w) { warnings.push('row ' + (i + 1) + ': ' + w); });

      var rec = v.rec;
      var key = dedupKey(rec);
      var at;
      keysOf(rec).some(function (k) {
        if (byKey[k] !== undefined) { at = byKey[k]; return true; }
        return false;
      });

      if (at === undefined) {
        board.push({
          id: hashId(key),
          title: rec.title, company: rec.company, location: rec.location,
          remote: rec.remote, source: rec.source, url: rec.url,
          apply_url: rec.apply_url, posted: rec.posted,
          first_seen: today, last_seen: today,
          score: rec.score, band: rec.band, rationale: rec.rationale,
          signal: rec.signal, resume_tailored: rec.resume_tailored,
          status: rec._status, hidden: rec._hidden, notes: rec._notes
        });
        keysOf(rec).forEach(function (k) { byKey[k] = board.length - 1; });
        added++;
      } else {
        var cur = board[at];
        /* Refresh what the agent owns. Leave status, hidden, notes and
           first_seen exactly as they are: they are the human's triage and
           an import must not undo it. */
        cur.title = rec.title;
        cur.company = rec.company;
        cur.location = rec.location;
        cur.remote = rec.remote;
        cur.source = rec.source;
        cur.url = rec.url || cur.url;
        cur.apply_url = rec.apply_url || cur.apply_url;
        cur.posted = rec.posted || cur.posted;
        cur.score = rec.score;
        cur.band = rec.band;
        cur.rationale = rec.rationale || cur.rationale;
        cur.signal = rec.signal || cur.signal;
        cur.resume_tailored = rec.resume_tailored || cur.resume_tailored;
        cur.last_seen = today;
        updated++;
      }
    });

    save();
    return { added: added, updated: updated, rejected: rejected, warnings: warnings };
  }

  /* Derived views -------------------------------------------------- */
  function visible() {
    return board.filter(function (r) { return !r.hidden; });
  }

  function latestDate() {
    return visible().reduce(function (acc, r) {
      return r.last_seen > acc ? r.last_seen : acc;
    }, '');
  }

  function filtered() {
    var q = filters.q.trim().toLowerCase();
    return visible().filter(function (r) {
      if (filters.status === 'all') {
        if (DONE.indexOf(r.status) !== -1) return false;
      } else if (r.status !== filters.status) {
        return false;
      }
      if (filters.score !== 'all' && r.band !== filters.score) return false;
      if (!q) return true;
      return (r.company + ' ' + r.title + ' ' + r.rationale + ' ' + r.location + ' ' + r.source)
        .toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      return b.score - a.score || a.company.localeCompare(b.company);
    });
  }

  /* Render --------------------------------------------------------- */
  var el = {};
  function cache() {
    ['last-updated', 'report-label', 'best-company', 'best-meta', 's-inview', 's-strong',
     's-applied', 's-progress', 'result-count', 'latest-date', 'latest-count', 'latest-seen',
     'rows', 'empty', 'pipeline', 'hidden-list', 'hidden-empty', 'toast'].forEach(function (id) {
      el[id] = document.getElementById(id);
    });
  }

  function renderStats() {
    var vis = visible();
    el['s-inview'].textContent = vis.length;
    el['s-strong'].textContent = vis.filter(function (r) { return r.score >= 90; }).length;
    el['s-applied'].textContent = vis.filter(function (r) {
      return r.status === 'applied' || r.status === 'interviewing' || r.status === 'offer';
    }).length;
    el['s-progress'].textContent = vis.filter(function (r) {
      return PIPELINE.indexOf(r.status) !== -1;
    }).length;
  }

  function renderHeader() {
    el['last-updated'].textContent = meta.updated ? prettyDate(meta.updated) : 'never';

    var latest = latestDate();
    el['report-label'].textContent = latest
      ? 'DAILY OPPORTUNITY REPORT / ' + prettyDate(latest).toUpperCase()
      : 'DAILY OPPORTUNITY REPORT';
    el['latest-date'].textContent = latest ? prettyDate(latest) : 'No reports yet';

    /* Count what ARRIVED today, not what was seen today.

       merge() bumps last_seen on every row an import touches, and the agent
       re-emits live postings every morning, so counting last_seen meant a
       morning where nothing new turned up still reported "August 4, 10 JOBS".
       The board could not tell 10 arrived from 10 re-seen, which is the same
       staleness weekly-roundup.md forbids the Friday task from causing. */
    var todays = visible().filter(function (r) { return r.last_seen === latest; });
    var arrived = todays.filter(function (r) { return r.first_seen === latest; });
    el['latest-count'].textContent = arrived.length;
    el['latest-seen'].textContent = arrived.length === todays.length
      ? ''
      : ' new, ' + (todays.length - arrived.length) + ' still live';

    /* "Best opportunity today" is a recommendation, so it has to respect the
       same rule the daily list does: a role she has already applied to is not
       something to do today. Without this the hero card kept recommending a
       role every morning after she had actioned it, while the list below
       correctly omitted it, which is rule 2 in CLAUDE.md leaking.

       Fall back to the whole pool when everything is actioned, so the card
       says something true rather than going blank, and label it. */
    var pool = todays.length ? todays : visible();
    var actionable = pool.filter(function (r) { return DONE.indexOf(r.status) === -1; });
    var best = (actionable.length ? actionable : pool)
      .slice().sort(function (a, b) { return b.score - a.score; })[0];
    if (best) {
      el['best-company'].textContent = best.company;
      el['best-meta'].textContent = [best.title, best.location || best.remote,
                                    best.score + ' match score',
                                    DONE.indexOf(best.status) === -1 ? '' : 'already ' + best.status]
                                    .filter(Boolean).join(' · ');
    } else if (board.length) {
      /* Rows exist but every one is hidden. Saying "nothing imported yet" here
         is simply false, and there is no affordance either, because the empty
         state is gated on the board being empty rather than on the view being
         empty. Say what is actually true. */
      el['best-company'].textContent = 'Everything is hidden';
      el['best-meta'].textContent = board.length + ' role' + (board.length === 1 ? '' : 's') +
        ' on the board, all of them ruled out. Restore one from Hidden roles.';
      el['latest-date'].textContent = 'All hidden';
    } else {
      el['best-company'].textContent = 'Nothing imported yet';
      el['best-meta'].textContent = 'Import a digest to see the day’s top match.';
    }
  }

  function statusOptions(current) {
    return STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' +
             s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
    }).join('');
  }

  function renderRows() {
    var rows = filtered();
    el['empty'].hidden = board.length !== 0;

    if (filters.status === 'all') {
      var inPipeline = visible().filter(function (r) {
        return DONE.indexOf(r.status) !== -1;
      }).length;
      el['result-count'].textContent = rows.length + ' to action' +
        (inPipeline ? ', ' + inPipeline + ' already in your pipeline' : '');
    } else {
      el['result-count'].textContent = rows.length +
        (rows.length === 1 ? ' opportunity' : ' opportunities');
    }

    if (!rows.length) {
      el['rows'].innerHTML = board.length
        ? '<p class="rail-note">Nothing left to action here. Everything else is in your ' +
          'pipeline or hidden, and clicking a pipeline row brings it back.</p>'
        : '';
      return;
    }

    el['rows'].innerHTML = rows.map(function (r) {
      var url = safeUrl(r.url);
      var applyUrl = safeUrl(r.apply_url);
      return '' +
      '<details class="row" data-id="' + esc(r.id) + '">' +
        '<summary>' +
          '<span class="score is-' + esc(r.band) + '">' + r.score + '</span>' +
          '<span>' +
            '<span class="row-co">' + esc(r.company) + '</span>' +
            '<span class="row-title">' + esc(r.title) + '</span>' +
          '</span>' +
          '<span class="row-evi">' + esc(r.signal || r.location) + '</span>' +
          '<span class="pill st-' + esc(r.status) + '">' + esc(r.status) + '</span>' +
          (applyUrl
            ? '<a class="row-apply" href="' + esc(applyUrl) + '" target="_blank" rel="noopener"' +
              ' data-act="applylink" aria-label="Apply to ' + esc(r.title) + ' at ' +
              esc(r.company) + ', opens in a new tab">Apply &#8599;</a>'
            : '<span></span>') +
          '<span class="chev" aria-hidden="true">&#9662;</span>' +
        '</summary>' +
        '<div class="row-body">' +
          '<p class="row-why">' + esc(r.rationale || 'No rationale was supplied for this one.') + '</p>' +
          '<div class="row-facts">' +
            '<span>Location <b>' + esc(r.location || 'not stated') + '</b></span>' +
            '<span>Arrangement <b>' + esc(r.remote) + '</b></span>' +
            '<span>Source <b>' + esc(r.source) + '</b></span>' +
            '<span>Posted <b>' + esc(r.posted || 'not stated') + '</b></span>' +
            '<span>First seen <b>' + esc(r.first_seen) + '</b></span>' +
            '<span>Last seen <b>' + esc(r.last_seen) + '</b></span>' +
            (r.resume_tailored ? '<span><b>Tailored resume sent</b></span>' : '') +
          '</div>' +
          '<div class="row-tools">' +
            (DONE.indexOf(r.status) === -1
              ? '<button type="button" class="solid" data-act="applied">Mark as applied</button>'
              : '') +
            '<select data-act="status" aria-label="Status for ' + esc(r.title) + '">' +
              statusOptions(r.status) +
            '</select>' +
            '<button type="button" class="ghost" data-act="hide">Hide</button>' +
            (url ? '<a class="row-link" href="' + esc(url) + '" target="_blank" rel="noopener">View posting &rarr;</a>' : '') +
          '</div>' +
          '<textarea class="row-notes" data-act="notes" placeholder="Notes, call prep, who you spoke to" aria-label="Notes for ' + esc(r.title) + '">' + esc(r.notes) + '</textarea>' +
        '</div>' +
      '</details>';
    }).join('');
  }

  function renderRail() {
    var counts = {};
    PIPELINE.forEach(function (s) {
      counts[s] = board.filter(function (r) { return !r.hidden && r.status === s; }).length;
    });
    var hiddenRows = board.filter(function (r) { return r.hidden; });

    /* Each pipeline row filters the board to that status, which is how an
       applied role comes back into view after it drops out of the daily list. */
    el['pipeline'].innerHTML = PIPELINE.map(function (s) {
      return '<li><button type="button" class="pipe-btn" data-act="pipe" data-status="' + s +
             '" aria-pressed="' + (filters.status === s) + '">' +
             s.charAt(0).toUpperCase() + s.slice(1) +
             '<span class="pipe-n' + (counts[s] ? ' has' : '') + '">' + counts[s] +
             '</span></button></li>';
    }).join('') +
    '<li><span class="pipe-row">Hidden<span class="pipe-n' +
    (hiddenRows.length ? ' has' : '') + '">' + hiddenRows.length + '</span></span></li>';

    el['hidden-empty'].hidden = hiddenRows.length > 0;
    el['hidden-list'].innerHTML = hiddenRows.map(function (r) {
      return '<li data-id="' + esc(r.id) + '">' +
               '<span>' +
                 '<span class="hid-co">' + esc(r.company) + '</span>' +
                 '<span class="hid-title">' + esc(r.title) + '</span>' +
               '</span>' +
               '<button type="button" class="restore" data-act="restore">Restore</button>' +
             '</li>';
    }).join('');
  }

  function render() {
    renderStats();
    renderHeader();
    renderRows();
    renderRail();
  }

  /* Toast ---------------------------------------------------------- */
  var toastTimer = null;
  function toast(msg) {
    if (!el['toast']) return;
    el['toast'].textContent = msg;
    el['toast'].hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el['toast'].hidden = true; }, 4200);
  }

  /* Record lookup -------------------------------------------------- */
  function recFrom(node) {
    var host = node.closest('[data-id]');
    if (!host) return null;
    var id = host.getAttribute('data-id');
    for (var i = 0; i < board.length; i++) {
      if (board[i].id === id) return board[i];
    }
    return null;
  }

  /* Wiring --------------------------------------------------------- */
  function wire() {
    document.getElementById('q').addEventListener('input', function (e) {
      filters.q = e.target.value;
      renderRows();
    });
    document.getElementById('f-status').addEventListener('change', function (e) {
      filters.status = e.target.value;
      renderRows();
    });
    document.getElementById('f-score').addEventListener('change', function (e) {
      filters.score = e.target.value;
      renderRows();
    });
    document.getElementById('clear').addEventListener('click', function () {
      filters = { q: '', status: 'all', score: 'all' };
      document.getElementById('q').value = '';
      document.getElementById('f-status').value = 'all';
      document.getElementById('f-score').value = 'all';
      renderRows();
    });

    /* Delegated, because rows are re-rendered on every change. */
    document.addEventListener('change', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act !== 'status' && act !== 'notes') return;
      var rec = recFrom(e.target);
      if (!rec) return;
      if (act === 'status') {
        rec.status = e.target.value;
        save();
        render();
      } else {
        rec.notes = e.target.value;
        save();
      }
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');

      /* The apply link lives inside <summary>, so its click would bubble up
         and toggle the fold as a side effect of opening the posting. */
      if (act === 'applylink') {
        e.stopPropagation();
        return;
      }

      /* Pipeline rows filter the board back to a status. */
      if (act === 'pipe') {
        var want = btn.getAttribute('data-status');
        filters.status = (filters.status === want) ? 'all' : want;
        document.getElementById('f-status').value = filters.status;
        renderRows();
        renderRail();
        return;
      }

      if (act === 'applied') {
        var app = recFrom(btn);
        if (!app) return;
        app.status = 'applied';
        save();
        render();
        toast('"' + app.title + '" marked as applied. It has moved to your pipeline and will ' +
              'not come back into the daily list, even if the agent finds it again.');
        return;
      }

      if (act !== 'hide' && act !== 'restore') return;
      var rec = recFrom(btn);
      if (!rec) return;
      rec.hidden = (act === 'hide');
      save();
      render();
      toast(act === 'hide'
        ? '"' + rec.title + '" hidden. It is in Hidden roles, not deleted.'
        : '"' + rec.title + '" restored to the board.');
    });

    /* Brief the agent -------------------------------------------------
       The scheduled task has no read path to this board, and it never will,
       because there is no server. So it keeps re-emitting a role she already
       applied to and re-selling one she hid, and the Friday roundup cannot
       answer "what is still unactioned at 90 plus" at all.

       It does not need the board. It needs the list. This produces the
       smallest thing that closes the loop: what to skip and what she has not
       actioned yet, as text she can paste into the task or park at a URL the
       task fetches. Nothing here is uploaded by the app itself. */
    function agentBrief() {
      var skip = board.filter(function (r) {
        return r.hidden || DONE.indexOf(r.status) !== -1;
      });
      var openStrong = board.filter(function (r) {
        return !r.hidden && r.score >= 90 && DONE.indexOf(r.status) === -1;
      }).sort(function (a, b) { return b.score - a.score; });

      var lines = [];
      lines.push('# Board state as of ' + todayISO());
      lines.push('# Paste this into the scheduled task, or host it and have the task fetch it.');
      lines.push('# Generated by the dashboard. Do not edit by hand.');
      lines.push('');
      lines.push('## Do not emit these again. Applied, interviewing, offer, closed or hidden.');
      lines.push('# Match on the URL where there is one, because an aggregator will change the');
      lines.push('# title and the location for the same job. "Saved" is NOT on this list: a role');
      lines.push('# she saved but has not actioned is still worth re-emitting.');
      if (skip.length) {
        /* The canonical URL is on every skip row on purpose. Without it the
           agent has to match on a name string, and a name string is exactly
           what an aggregator mangles: "AI Deployment Manager - New York" is a
           different string for the same job. A URL is matchable. */
        skip.forEach(function (r) {
          lines.push('- ' + r.company + ' | ' + r.title +
                     ' | ' + (r.hidden ? 'hidden' : r.status) +
                     (r.url ? ' | ' + r.url : ''));
        });
      } else {
        lines.push('- nothing yet');
      }
      lines.push('');
      lines.push('## Scored 90 plus and not actioned. This is the Friday roundup list.');
      if (openStrong.length) {
        openStrong.forEach(function (r) {
          lines.push('- ' + r.score + ' | ' + r.company + ' | ' + r.title +
                     ' | ' + r.status + ' | first seen ' + r.first_seen);
        });
      } else {
        lines.push('- nothing outstanding');
      }
      lines.push('');
      return lines.join('\n');
    }

    document.getElementById('brief').addEventListener('click', function () {
      var text = agentBrief();
      var done = function (how) {
        toast('Agent brief copied ' + how + '. Paste it into the scheduled task so it stops ' +
              're-emitting roles you have already actioned.');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done('to your clipboard'); },
          function () { downloadBrief(text); });
      } else {
        downloadBrief(text);
      }
    });

    function downloadBrief(text) {
      var blob = new Blob([text], { type: 'text/markdown' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'agent-brief-' + todayISO() + '.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('Agent brief downloaded. Paste it into the scheduled task.');
    }

    /* Export */
    document.getElementById('export').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'jsd-board-' + todayISO() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('Exported ' + board.length + ' rows, hidden ones included.');
    });

    /* Sample data */
    var sample = document.getElementById('load-sample');
    if (sample) {
      sample.addEventListener('click', function () {
        fetch('data/sample-opportunities.json')
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function (rows) {
            var res = merge(rows);
            render();
            toast('Loaded sample data: ' + res.added + ' added.');
          })
          .catch(function () {
            toast('Could not read data/sample-opportunities.json. Serve the folder over http rather than opening the file directly.');
          });
      });
    }

    /* Import dialog */
    var dlg = document.getElementById('import-dlg');
    var report = document.getElementById('import-report');
    var txt = document.getElementById('import-txt');

    document.getElementById('import-open').addEventListener('click', function () {
      report.hidden = true;
      txt.value = '';
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    });
    document.getElementById('import-cancel').addEventListener('click', function () {
      dlg.close();
    });

    document.getElementById('import-run').addEventListener('click', function () {
      /* Strip a markdown code fence if one came along for the ride. The digest
         puts the array in a fenced block, and a phone mail client renders the
         fence as literal backticks, so the likeliest paste in the whole system
         is one with ```json on the front. Failing that with "unexpected token"
         would break the only manual step in the pipeline, before work, on a
         phone. Also tolerate leading prose up to the first bracket. */
      /* Trim from both ends. Anchoring the closing fence to end-of-string meant
         one trailing sentence, a signature, or a footer after the block broke
         the import, and a four-backtick fence was not matched at all. Markdown
         uses four whenever the content itself contains a fence, which the
         prompt files do. So: find the first bracket and the last matching one,
         and keep what is between them. */
      var raw = txt.value.trim().replace(/^`{3,}[a-z]*\s*/i, '').replace(/\s*`{3,}$/, '').trim();
      var firstBracket = raw.search(/[[{]/);
      if (firstBracket > 0) raw = raw.slice(firstBracket);
      var lastBracket = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
      if (lastBracket !== -1 && lastBracket < raw.length - 1) raw = raw.slice(0, lastBracket + 1);

      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        report.hidden = false;
        report.className = 'dlg-report bad';
        report.innerHTML = '<b>That is not valid JSON.</b><br>' + esc(err.message) +
          '<br>Paste just the array, from the first <code>[</code> to the last ' +
          '<code>]</code>. A code fence or any surrounding text is fine, but a ' +
          'truncated copy is not, and a phone will often cut the end off.';
        return;
      }
      if (!Array.isArray(parsed)) parsed = [parsed];

      var res = merge(parsed);
      render();

      var lines = '<b>' + res.added + ' added, ' + res.updated + ' updated, ' +
                  res.rejected.length + ' rejected.</b>';
      if (res.updated) {
        lines += '<br>Updated rows kept their status, notes and hidden state.';
      }
      if (res.rejected.length) {
        lines += '<ul>' + res.rejected.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
      }
      if (res.warnings.length) {
        lines += '<ul>' + res.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
      }
      report.hidden = false;
      report.className = 'dlg-report ' + (res.rejected.length ? 'bad' : 'ok');
      report.innerHTML = lines;
    });
  }

  /* Boot ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    cache();
    load();
    wire();
    render();
  });
})();
