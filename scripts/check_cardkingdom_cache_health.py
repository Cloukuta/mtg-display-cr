import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STALE_HOURS = int(os.environ.get("CK_CACHE_STALE_HOURS", "36"))


def require_environment():
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise RuntimeError("Missing required environment variables: " + ", ".join(missing))


def request(path, prefer_count=False):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
    }
    if prefer_count:
        headers["Prefer"] = "count=exact"
        headers["Range"] = "0-0"
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}",
        headers=headers,
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            body = response.read()
            payload = json.loads(body.decode("utf-8")) if body else []
            return payload, response.headers
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase GET {path} failed ({exc.code}): {body}"
        ) from exc


def exact_count(path):
    _, headers = request(path, prefer_count=True)
    content_range = headers.get("Content-Range", "")
    if "/" not in content_range:
        raise RuntimeError(f"Supabase did not return an exact count for {path}")
    total = content_range.rsplit("/", 1)[1]
    if total == "*":
        raise RuntimeError(f"Supabase returned an unknown count for {path}")
    return int(total)


def main():
    require_environment()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=STALE_HOURS)
    cutoff_iso = cutoff.replace(microsecond=0).isoformat()

    total_rows = exact_count("cardkingdom_price_cache?select=scryfall_id")

    # PostgREST filter values must be URL encoded as query values. In particular,
    # an ISO-8601 UTC offset contains '+', which otherwise becomes a space when
    # parsed as a query string and causes PostgreSQL timestamptz to return 400.
    stale_filter = urllib.parse.quote(f"lt.{cutoff_iso}", safe="")
    stale_rows = exact_count(
        f"cardkingdom_price_cache?select=scryfall_id&updated_at={stale_filter}"
    )

    newest, _ = request(
        "cardkingdom_price_cache?select=updated_at&order=updated_at.desc&limit=1"
    )
    oldest, _ = request(
        "cardkingdom_price_cache?select=updated_at&order=updated_at.asc&limit=1"
    )

    newest_at = newest[0]["updated_at"] if newest else None
    oldest_at = oldest[0]["updated_at"] if oldest else None
    status = "HEALTHY" if total_rows > 0 and stale_rows == 0 else "ATTENTION"

    print("\nCARD KINGDOM CACHE HEALTH")
    print("==========================")
    print(f"Cached price rows: {total_rows:,}")
    print(f"Oldest updated_at: {oldest_at or 'N/A'}")
    print(f"Newest updated_at: {newest_at or 'N/A'}")
    print(f"Stale threshold: {STALE_HOURS} hours")
    print(f"Stale rows: {stale_rows:,}")
    print(f"Sync status: {status}")
    print("Missing products are retained in cache; this health check never deletes rows.")

    if total_rows == 0:
        raise RuntimeError("Card Kingdom cache is empty after synchronization")


if __name__ == "__main__":
    main()
