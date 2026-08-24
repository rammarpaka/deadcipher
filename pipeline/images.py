from __future__ import annotations

import hashlib
import io
import os
import re
from urllib.parse import urljoin

import httpx
from PIL import Image

MAX_BYTES = 5 * 1024 * 1024
TARGET_WIDTH = 800
JPEG_QUALITY = 80
DEFAULT_BUCKET = "deadcipher-images"

_OG_PROPERTY_FIRST = re.compile(
    r"<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']",
    re.IGNORECASE,
)
_OG_CONTENT_FIRST = re.compile(
    r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']",
    re.IGNORECASE,
)


def is_configured() -> bool:
    return all(
        os.environ.get(k)
        for k in ("R2_ENDPOINT", "R2_ACCESS_KEY", "R2_SECRET_KEY")
    )


def extract_og_image(html: str, base_url: str) -> str | None:
    match = _OG_PROPERTY_FIRST.search(html) or _OG_CONTENT_FIRST.search(html)
    if not match:
        return None
    return urljoin(base_url, match.group(1).strip())


def _r2_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["R2_SECRET_KEY"],
        region_name="auto",
    )


def process_image(
    image_url: str, article_url: str, client: httpx.Client
) -> str | None:
    """Download, downscale, and upload an image to R2. Returns object key."""
    if not is_configured():
        return None
    try:
        resp = client.get(image_url, follow_redirects=True, timeout=20.0)
        resp.raise_for_status()
        raw = resp.content
        if len(raw) > MAX_BYTES:
            print(f"[images] too large, skipped: {image_url[:70]}")
            return None
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        if img.width > TARGET_WIDTH:
            ratio = TARGET_WIDTH / img.width
            img = img.resize(
                (TARGET_WIDTH, max(1, int(img.height * ratio))), Image.LANCZOS
            )
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
        key = f"images/{hashlib.sha1(article_url.encode()).hexdigest()[:16]}.jpg"
        _r2_client().put_object(
            Bucket=os.environ.get("R2_BUCKET", DEFAULT_BUCKET),
            Key=key,
            Body=buf.getvalue(),
            ContentType="image/jpeg",
            CacheControl="public, max-age=31536000",
        )
        return key
    except Exception as exc:  # noqa: BLE001 — images are best-effort
        print(f"[images] skipped ({image_url[:60]}): {exc}")
        return None
