import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone

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
    with urllib.request.urlopen(req, timeout=180) as response:
        body = response.read()
        payload = json.loads(body.decode("utf-8")) if body else []
        return payload, response.headers


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
    cutoff = now.timestamp() - STALE_HOURS * 3600
    cutoff_iso = datetime.fromtimestamp(cutoff, timezone.utc).replace(microsecond=0).isoformat()

    total_rows = exact_count("cardkingdom_price_cache?select=id")
    stale_rows = exact_count(
        "cardkingdom_price_cache?select=id&updated_at=lt."
        + urllib.parse.quote(cutoff_iso, safe="-:T+")
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
