#!/usr/bin/env python3
"""
Fetch job postings from configured sources and normalise them to the contract
in CONTRACT.md.

Standard library only. No pip install, no API key needed for the ATS sources.

    python3 ingest/fetch_jobs.py                      # all enabled sources
    python3 ingest/fetch_jobs.py --only greenhouse    # one adapter
    python3 ingest/fetch_jobs.py --out out/today.json

Two stages, deliberately separate:

  1. SOURCING, which this script does. It reads employer boards and
     aggregators and emits contract-shaped records.
  2. SCORING. By default this script applies a transparent keyword prescore
     from ingest/rubric.json, so the output is importable with no model in the
     loop at all. Pass --no-prescore to emit score 0 and let the agent do the
     scoring instead.

The prescore is a keyword match, not a judgment, and every rationale it writes
says so. The point is that the deterministic path is the default and the model
is the upgrade, not the dependency.
"""

import argparse
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TODAY = date.today().isoformat()
UA = "job-search-dashboard/1.0 (+https://github.com/khalidduaa1-byte/Job-Search-Agent-Dashboard)"


# ----------------------------------------------------------------------------
# HTTP
# ----------------------------------------------------------------------------

def _ssl_context():
    """Respect an explicit CA bundle when the environment sets one.

    Never disables verification. If TLS fails, fix the bundle, do not turn
    checking off.
    """
    ca = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if ca and os.path.exists(ca):
        return ssl.create_default_context(cafile=ca)
    return ssl.create_default_context()


def get_json(url, timeout=25, headers=None):
    req = urllib.request.Request(url, headers=dict({"User-Agent": UA, "Accept": "application/json"},
                                                  **(headers or {})))
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
        raw = resp.read().decode("utf-8", "replace")
    return json.loads(raw)


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
          .replace("&nbsp;", " ").replace("&#39;", "'").replace("&quot;", '"'))
    return re.sub(r"\s+", " ", s).strip()


def iso_date(value):
    """Best-effort date normalisation to YYYY-MM-DD, empty string on failure."""
    if not value:
        return ""
    s = str(value)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%a, %d %b %Y %H:%M:%S %Z"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    if s.isdigit() and len(s) >= 10:
        try:
            # Not utcfromtimestamp: it is deprecated from Python 3.12 and warns on stderr,
            # which looks like a fetch failure in the middle of the ok/FAIL run log.
            return datetime.fromtimestamp(int(s[:10]), timezone.utc).date().isoformat()
        except (ValueError, OSError, OverflowError):
            pass
    return ""


def remote_of(location, extra=""):
    blob = (str(location) + " " + str(extra)).lower()
    if "remote" in blob:
        return "remote"
    if "hybrid" in blob:
        return "hybrid"
    if location:
        return "onsite"
    return "unknown"


def record(title, company, location, source, url, apply_url="", posted="",
           remote=None, description=""):
    """One contract-shaped record, pre-scoring."""
    return {
        "title": (title or "").strip(),
        "company": (company or "").strip(),
        "location": (location or "").strip(),
        "remote": remote or remote_of(location, description[:400]),
        "source": source,
        "url": url or "",
        "apply_url": apply_url or url or "",
        "posted": iso_date(posted),
        "score": 0,
        "rationale": "",
        "signal": "",
        "resume_tailored": False,
        "_description": description or "",
    }


# ----------------------------------------------------------------------------
# Adapters. Every one of these is a public, documented, no-key endpoint except
# adzuna, which needs a free app id and key.
# ----------------------------------------------------------------------------

def fetch_greenhouse(entry):
    token = entry["token"]
    url = "https://boards-api.greenhouse.io/v1/boards/%s/jobs?content=true" % urllib.parse.quote(token)
    data = get_json(url)
    out = []
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name", "")
        out.append(record(
            title=j.get("title"),
            company=entry.get("company", token),
            location=loc,
            source="greenhouse",
            url=j.get("absolute_url", ""),
            posted=j.get("updated_at") or j.get("first_published"),
            description=strip_html(j.get("content", "")),
        ))
    return out


def fetch_ashby(entry):
    token = entry["token"]
    url = "https://api.ashbyhq.com/posting-api/job-board/%s" % urllib.parse.quote(token)
    data = get_json(url)
    out = []
    for j in data.get("jobs", []):
        if j.get("isListed") is False:
            continue
        out.append(record(
            title=j.get("title"),
            company=entry.get("company", token),
            location=j.get("location", ""),
            source="ashby",
            url=j.get("jobUrl", ""),
            apply_url=j.get("applyUrl", ""),
            posted=j.get("publishedAt") or j.get("updatedAt"),
            remote="remote" if j.get("isRemote") else None,
            description=strip_html(j.get("descriptionPlain") or j.get("descriptionHtml") or ""),
        ))
    return out


def fetch_lever(entry):
    token = entry["token"]
    url = "https://api.lever.co/v0/postings/%s?mode=json" % urllib.parse.quote(token)
    data = get_json(url)
    out = []
    for j in data if isinstance(data, list) else []:
        cats = j.get("categories") or {}
        out.append(record(
            title=j.get("text"),
            company=entry.get("company", token),
            location=cats.get("location", ""),
            source="lever",
            url=j.get("hostedUrl", ""),
            apply_url=j.get("applyUrl", ""),
            posted=j.get("createdAt"),
            description=strip_html(j.get("descriptionPlain") or j.get("description") or ""),
        ))
    return out


def fetch_workable(entry):
    token = entry["token"]
    url = ("https://apply.workable.com/api/v1/widget/accounts/%s?details=true"
           % urllib.parse.quote(token))
    data = get_json(url)
    out = []
    for j in data.get("jobs", []):
        loc = ", ".join([p for p in [j.get("city"), j.get("country")] if p])
        out.append(record(
            title=j.get("title"),
            company=entry.get("company", token),
            location=loc,
            source="workable",
            url=j.get("shortlink") or j.get("url", ""),
            posted=j.get("published_on") or j.get("created_at"),
            description=strip_html(j.get("description", "")),
        ))
    return out


def fetch_smartrecruiters(entry):
    token = entry["token"]
    url = ("https://api.smartrecruiters.com/v1/companies/%s/postings?limit=100"
           % urllib.parse.quote(token))
    data = get_json(url)
    out = []
    for j in data.get("content", []):
        loc = (j.get("location") or {})
        where = ", ".join([p for p in [loc.get("city"), loc.get("country")] if p])
        out.append(record(
            title=j.get("name"),
            company=entry.get("company", token),
            location=where,
            source="smartrecruiters",
            url="https://jobs.smartrecruiters.com/%s/%s" % (token, j.get("id", "")),
            posted=j.get("releasedDate"),
            remote="remote" if loc.get("remote") else None,
        ))
    return out


def fetch_remotive(entry):
    """Free, no key. Remote roles only."""
    q = urllib.parse.quote(entry.get("query", ""))
    url = "https://remotive.com/api/remote-jobs?limit=%d" % int(entry.get("limit", 50))
    if q:
        url += "&search=" + q
    data = get_json(url)
    out = []
    for j in data.get("jobs", []):
        out.append(record(
            title=j.get("title"),
            company=j.get("company_name"),
            location=j.get("candidate_required_location", "Remote"),
            source="remotive",
            url=j.get("url", ""),
            posted=j.get("publication_date"),
            remote="remote",
            description=strip_html(j.get("description", "")),
        ))
    return out


def fetch_arbeitnow(entry):
    """Free, no key."""
    url = "https://www.arbeitnow.com/api/job-board-api"
    data = get_json(url)
    out = []
    for j in data.get("data", []):
        out.append(record(
            title=j.get("title"),
            company=j.get("company_name"),
            location=j.get("location", ""),
            source="arbeitnow",
            url=j.get("url", ""),
            posted=j.get("created_at"),
            remote="remote" if j.get("remote") else None,
            description=strip_html(j.get("description", "")),
        ))
    return out


def fetch_adzuna(entry):
    """Aggregator with real breadth. Needs a free app id and key.

    Set ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment. Never commit them.
    """
    app_id = os.environ.get("ADZUNA_APP_ID", "")
    app_key = os.environ.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        raise RuntimeError("set ADZUNA_APP_ID and ADZUNA_APP_KEY, or disable the adzuna source")
    country = entry.get("country", "us")
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": str(entry.get("limit", 50)),
        "what": entry.get("query", ""),
        "content-type": "application/json",
    }
    if entry.get("where"):
        params["where"] = entry["where"]
    url = ("https://api.adzuna.com/v1/api/jobs/%s/search/1?%s"
           % (country, urllib.parse.urlencode(params)))
    data = get_json(url)
    out = []
    for j in data.get("results", []):
        out.append(record(
            title=j.get("title"),
            company=(j.get("company") or {}).get("display_name", ""),
            location=(j.get("location") or {}).get("display_name", ""),
            source="adzuna",
            url=j.get("redirect_url", ""),
            posted=j.get("created"),
            description=strip_html(j.get("description", "")),
        ))
    return out


ADAPTERS = {
    "greenhouse": fetch_greenhouse,
    "ashby": fetch_ashby,
    "lever": fetch_lever,
    "workable": fetch_workable,
    "smartrecruiters": fetch_smartrecruiters,
    "remotive": fetch_remotive,
    "arbeitnow": fetch_arbeitnow,
    "adzuna": fetch_adzuna,
}


# ----------------------------------------------------------------------------
# The keyword prescore. Transparent on purpose: every point is attributable.
# ----------------------------------------------------------------------------

def load_rubric():
    with open(os.path.join(HERE, "rubric.json"), "r", encoding="utf-8") as fh:
        return json.load(fh)


def prescore(rec, rubric):
    title = rec["title"].lower()
    blob = (rec["title"] + " " + rec.get("_description", "")).lower()
    where = (rec["location"] + " " + rec["remote"]).lower()

    total = 0
    hits = []

    for group in rubric["title_families"]:
        if any(p in title for p in group["patterns"]):
            total += group["points"]
            hits.append("%s (+%d)" % (group["label"], group["points"]))
            break

    for kw in rubric["keywords"]:
        if any(p in blob for p in kw["patterns"]):
            total += kw["points"]
            hits.append("%s (+%d)" % (kw["label"], kw["points"]))

    for loc in rubric["locations"]:
        if any(p in where for p in loc["patterns"]):
            total += loc["points"]
            hits.append("%s (+%d)" % (loc["label"], loc["points"]))
            break

    # Penalties scan the location too, not just the title and description. The
    # out-of-scope penalty is written entirely in place names (london, dubai,
    # canada), so scanning only title plus description meant a London posting
    # with a clean description took no penalty at all and scored like a US one.
    # That is the single most important filter in the deterministic path.
    penalty_blob = blob + " " + where

    for neg in rubric["penalties"]:
        if any(p in penalty_blob for p in neg["patterns"]):
            total += neg["points"]
            hits.append("%s (%d)" % (neg["label"], neg["points"]))

    score = max(0, min(100, total))
    rec["score"] = score
    rec["rationale"] = ("Keyword prescore, not a judgment. Matched: "
                        + (", ".join(hits) if hits else "nothing in the rubric")
                        + ". Rescore with the agent before trusting the ordering.")
    return rec


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def dedup(rows):
    """Same key as the dashboard, so the two agree about what one posting is."""
    seen, out = {}, []
    for r in rows:
        url = r.get("url") or ""
        if url.startswith("http"):
            key = re.sub(r"/+$", "", re.sub(r"[?#].*$", "", url.lower()))
        else:
            # Collapse whitespace as well as stripping punctuation. The dashboard's
            # dedupKey() does both, and the two have to agree about what one posting
            # is or a row lands twice on import.
            key = "|".join(
                re.sub(r"\s+", " ",
                       re.sub(r"[^a-z0-9 ]", "", (r.get(f) or "").lower())).strip()
                for f in ("company", "title", "location"))
        if key in seen:
            continue
        seen[key] = True
        out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser(description="Fetch and normalise job postings.")
    ap.add_argument("--config", default=os.path.join(HERE, "sources.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "out", "candidates.json"))
    ap.add_argument("--only", action="append", help="limit to these adapters, repeatable")
    ap.add_argument("--min-score", type=int, default=0, help="drop rows below this prescore")
    ap.add_argument("--no-prescore", action="store_true",
                    help="emit score 0 and let the agent score instead")
    args = ap.parse_args()

    with open(args.config, "r", encoding="utf-8") as fh:
        config = json.load(fh)

    rubric = load_rubric()
    rows, failures = [], []

    for entry in config.get("sources", []):
        kind = entry.get("type")
        if not entry.get("enabled", True):
            continue
        if args.only and kind not in args.only:
            continue
        fn = ADAPTERS.get(kind)
        if not fn:
            failures.append("%s: no adapter" % kind)
            continue
        label = "%s/%s" % (kind, entry.get("token") or entry.get("query") or "")
        try:
            got = fn(entry)
            rows.extend(got)
            print("  ok    %-44s %3d postings" % (label, len(got)), file=sys.stderr)
        except urllib.error.HTTPError as e:
            failures.append("%s: HTTP %s" % (label, e.code))
            print("  FAIL  %-44s HTTP %s" % (label, e.code), file=sys.stderr)
        except Exception as e:  # noqa: BLE001 - one bad source must not stop the run
            failures.append("%s: %s" % (label, e))
            print("  FAIL  %-44s %s" % (label, e), file=sys.stderr)

    rows = dedup(rows)

    if not args.no_prescore:
        rows = [prescore(r, rubric) for r in rows]
    if args.min_score:
        rows = [r for r in rows if r["score"] >= args.min_score]

    rows.sort(key=lambda r: (-r["score"], r["company"]))
    for r in rows:
        r["signal"] = "%s adapter, fetched %s" % (r["source"], TODAY)
        r.pop("_description", None)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print("\n%d postings written to %s" % (len(rows), args.out), file=sys.stderr)
    if failures:
        print("%d source(s) failed:" % len(failures), file=sys.stderr)
        for f in failures:
            print("  - %s" % f, file=sys.stderr)
    print("\nPaste the contents into the dashboard's Import digest box.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
