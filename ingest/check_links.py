#!/usr/bin/env python3
"""Check whether the postings on the board are still open.

    python3 ingest/check_links.py                     # every published digest
    python3 ingest/check_links.py --digest 2026-08-03
    python3 ingest/check_links.py --write             # also update liveness.json
    python3 ingest/check_links.py --json              # machine readable, for a routine

WHY AN HTTP STATUS CODE IS THE WRONG CHECK, WHICH IS THE ENTIRE POINT OF THIS FILE.

The obvious version of this script is a HEAD request per URL, treating a 404 as
gone. It does not work, and it fails in the direction that matters: it reports
everything as fine.

Measured on the twenty roles of the 2026-08-03 digest: all twenty returned HTTP
200, including postings that are no longer accepting applications. Ashby and
Greenhouse serve a client-rendered shell, about 7KB of loader markup, at the same
status code whether the requisition behind it is open, closed or was never real.
The words "no longer accepting applications" are painted in by JavaScript after
the fact. So a status check cannot tell a live posting from a dead one, and a
green run would mean nothing at all.

The authoritative answer is the employer's own board feed, which is the same
endpoint ingest/fetch_jobs.py already sources from. A posting is open if and only
if the board still lists its id. Ashby even states it outright with isListed.

That also makes this cheap. Postings are grouped by employer, so twenty roles at
nine employers costs nine requests rather than twenty, and checking the whole
backlog stays one request per board no matter how many rows sit behind it.

WHAT THIS DELIBERATELY DOES NOT DO. It never edits the board and never changes a
status. A delisted posting is information for her, not a decision to make on her
behalf, and status belongs to the human under non-negotiable 1. It writes one
file, liveness.json, next to the digests, and the board renders it as a chip.

Stdlib only, like the rest of ingest/.
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
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIGESTS = os.path.join(ROOT, "data", "digests")

UA = "job-search-dashboard/1.0 (+https://github.com/khalidduaa1-byte/Job-Search-Agent-Dashboard)"

# Verdicts. "unknown" is not a failure and must not be reported as one: it means
# this script could not reach an authoritative feed, which is a fact about the
# checker and not about the posting.
OPEN, GONE, UNKNOWN = "open", "gone", "unknown"


def _ssl_context():
    ca = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if ca and os.path.exists(ca):
        return ssl.create_default_context(cafile=ca)
    return ssl.create_default_context()


def get_json(url, timeout=30):
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


# ----------------------------------------------------------------------------
# Which board is this posting on, and what is its id there
# ----------------------------------------------------------------------------

def load_watchlist():
    """company name, lowercased, to (ats, token), from the sourcing watchlist.

    Needed because plenty of employers front their ATS with their own domain.
    Asana serves www.asana.com/jobs/apply/8027437?gh_jid=8027437 and Harvey
    serves www.harvey.ai/company/careers/<uuid>. Both carry a perfectly good
    posting id, and neither URL says which board it belongs to, so on the URL
    alone both came back unverifiable. sources.json already knows: Asana is
    greenhouse/asana, Harvey is ashby/harvey.
    """
    path = os.path.join(HERE, "sources.json")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    out = {}
    for e in (data.get("sources") if isinstance(data, dict) else data) or []:
        ats, token, company = e.get("type"), e.get("token"), e.get("company")
        if ats in BOARDS and token and company:
            out[company.strip().lower()] = (ats, token)
    return out


def parse_posting(url, company="", watchlist=None):
    """Pull the ATS, the board token and the posting id out of a posting URL.

    Falls back to the watchlist when the URL is a company careers page that
    carries a usable id. Returns None when there is nothing to check against.
    """
    if not url:
        return None
    try:
        u = urllib.parse.urlparse(url)
    except ValueError:
        return None
    host, path = (u.netloc or "").lower(), (u.path or "").strip("/")
    parts = [p for p in path.split("/") if p]

    if "ashbyhq.com" in host and len(parts) >= 2:
        # /<token>/<uuid>[/application]
        return ("ashby", parts[0], parts[1])
    if "greenhouse.io" in host and parts:
        # boards.greenhouse.io/<token>/jobs/<id>, and the embed variant
        # job-boards.greenhouse.io/<token>/jobs/<id>
        if "jobs" in parts:
            i = parts.index("jobs")
            if i >= 1 and i + 1 < len(parts):
                return ("greenhouse", parts[0], parts[i + 1])
        qs = urllib.parse.parse_qs(u.query or "")
        if parts and qs.get("gh_jid"):
            return ("greenhouse", parts[0], qs["gh_jid"][0])
    if "lever.co" in host and len(parts) >= 2:
        return ("lever", parts[0], parts[1])
    if "workable.com" in host and len(parts) >= 2:
        # apply.workable.com/<token>/j/<CODE>/
        if parts[1] == "j" and len(parts) >= 3:
            return ("workable", parts[0], parts[2])

    # A company's own careers domain. The board is not in the URL, so ask the
    # watchlist which ATS this employer uses, then find an id in the URL.
    known = (watchlist or {}).get((company or "").strip().lower())
    if known:
        ats, token = known
        qs = urllib.parse.parse_qs(u.query or "")
        if qs.get("gh_jid") and ats == "greenhouse":
            return (ats, token, qs["gh_jid"][0])
        m = re.search(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", path)
        if m and ats == "ashby":
            return (ats, token, m.group(1))
        m = re.search(r"/(\d{6,})(?:/|$)", "/" + path)
        if m and ats in ("greenhouse", "lever"):
            return (ats, token, m.group(1))
    return None


# ----------------------------------------------------------------------------
# One request per board, returning the set of ids still listed
# ----------------------------------------------------------------------------

def live_ids_ashby(token):
    d = get_json("https://api.ashbyhq.com/posting-api/job-board/%s"
                 % urllib.parse.quote(token))
    ids = set()
    for j in d.get("jobs", []):
        # isListed is Ashby telling us directly. Absent means listed.
        if j.get("isListed") is False:
            continue
        for key in ("id", "jobId"):
            if j.get(key):
                ids.add(str(j[key]).lower())
        m = re.search(r"/([0-9a-f-]{36})", j.get("jobUrl") or "")
        if m:
            ids.add(m.group(1).lower())
    return ids


def live_ids_greenhouse(token):
    d = get_json("https://boards-api.greenhouse.io/v1/boards/%s/jobs"
                 % urllib.parse.quote(token))
    return {str(j.get("id")).lower() for j in d.get("jobs", []) if j.get("id")}


def live_ids_lever(token):
    d = get_json("https://api.lever.co/v0/postings/%s?mode=json"
                 % urllib.parse.quote(token))
    return {str(j.get("id")).lower() for j in d if j.get("id")}


def live_ids_workable(token):
    d = get_json("https://apply.workable.com/api/v1/widget/accounts/%s"
                 % urllib.parse.quote(token))
    return {str(j.get("shortcode")).lower() for j in d.get("jobs", [])
            if j.get("shortcode")}


BOARDS = {
    "ashby": live_ids_ashby,
    "greenhouse": live_ids_greenhouse,
    "lever": live_ids_lever,
    "workable": live_ids_workable,
}


def board_snapshot(ats, token, cache):
    """Fetch a board once and remember it, including the failure."""
    key = (ats, token)
    if key in cache:
        return cache[key]
    try:
        cache[key] = (BOARDS[ats](token), "")
    except urllib.error.HTTPError as e:
        cache[key] = (None, "HTTP %s" % e.code)
    except Exception as e:  # noqa: BLE001 - one dead board must not stop the rest
        cache[key] = (None, type(e).__name__)
    return cache[key]


# ----------------------------------------------------------------------------
# Checking a digest
# ----------------------------------------------------------------------------

def check_rows(rows, cache=None, watchlist=None):
    cache = {} if cache is None else cache
    watchlist = load_watchlist() if watchlist is None else watchlist
    out = []
    for r in rows:
        url = (r.get("url") or "").strip()
        rec = {
            "url": url,
            "company": r.get("company", ""),
            "title": r.get("title", ""),
            "state": UNKNOWN,
            "why": "",
        }
        parsed = parse_posting(url, r.get('company', ''), watchlist)
        if not parsed:
            rec["why"] = ("no board feed known for this employer, add it to ingest/sources.json" if url else "no url")
            out.append(rec)
            continue
        ats, token, pid = parsed
        ids, err = board_snapshot(ats, token, cache)
        if ids is None:
            rec["why"] = "%s board unreachable, %s" % (ats, err)
        elif pid.lower() in ids:
            rec["state"] = OPEN
            rec["why"] = "listed on the %s board" % ats
        else:
            rec["state"] = GONE
            rec["why"] = "not on the %s board any more" % ats
        out.append(rec)
    return out


def load_digest(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data if isinstance(data, list) else data.get("items", [])


def token_dirs():
    if not os.path.isdir(DIGESTS):
        return []
    return [os.path.join(DIGESTS, d) for d in sorted(os.listdir(DIGESTS))
            if os.path.isdir(os.path.join(DIGESTS, d))]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--digest", action="append", default=[],
                    help="digest id to check, repeatable. Default is all of them")
    ap.add_argument("--write", action="store_true",
                    help="write liveness.json beside the digests")
    ap.add_argument("--json", action="store_true", help="print JSON instead of a table")
    args = ap.parse_args()

    cache, results, checked_files = {}, {}, 0
    watchlist = load_watchlist()
    for tdir in token_dirs():
        for name in sorted(os.listdir(tdir)):
            if not name.endswith(".json") or name in ("index.json", "liveness.json"):
                continue
            did = name[:-5]
            if args.digest and did not in args.digest:
                continue
            checked_files += 1
            for rec in check_rows(load_digest(os.path.join(tdir, name)), cache, watchlist):
                # A posting can appear in more than one morning. Keep one entry
                # per URL, and let a definite answer beat an unknown.
                prev = results.get(rec["url"])
                if prev is None or (prev["state"] == UNKNOWN and rec["state"] != UNKNOWN):
                    results[rec["url"]] = rec

        if args.write and results:
            payload = {
                "checked": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "gone": sorted(u for u, r in results.items() if r["state"] == GONE),
                "unknown": sorted(u for u, r in results.items() if r["state"] == UNKNOWN),
            }
            with open(os.path.join(tdir, "liveness.json"), "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2)
                fh.write("\n")

    rows = sorted(results.values(), key=lambda r: (r["state"] != GONE, r["company"]))
    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        if not rows:
            print("No digests found under data/digests/.")
            return 0
        print("%-8s %-14s %s" % ("STATE", "COMPANY", "TITLE"))
        for r in rows:
            print("%-8s %-14s %s" % (r["state"], r["company"][:14], r["title"][:52]))
            if r["state"] != OPEN:
                print("%-8s %-14s   %s" % ("", "", r["why"]))
        n_gone = sum(1 for r in rows if r["state"] == GONE)
        n_unk = sum(1 for r in rows if r["state"] == UNKNOWN)
        print("\n%d postings across %d digest file(s): %d open, %d gone, %d unverifiable"
              % (len(rows), checked_files, len(rows) - n_gone - n_unk, n_gone, n_unk))
        if n_unk:
            print("Unverifiable is not the same as gone. It means no board feed could be "
                  "read, so the posting was not checked either way.")

    # Exit 1 only when something is actually gone, so a routine can branch on it.
    return 1 if any(r["state"] == GONE for r in results.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
