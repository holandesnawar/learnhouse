"""
Redis cache layer for course listings.

Caches public course lists by org slug with short TTLs.
Invalidated when courses are created, updated, or deleted.
"""

import json
import logging
from typing import Optional

from src.core.redis import get_redis_client

_get_redis_client = get_redis_client

logger = logging.getLogger(__name__)

CACHE_TTL_COURSES_LIST = 60  # 1 min — public course list

_KEY_PREFIX = "courses_cache"


def get_cached_courses_list(org_slug: str, page: int, limit: int) -> Optional[list]:
    """Return cached public course list for an org, or None."""
    r = get_redis_client()
    if r is None:
        return None
    try:
        key = f"{_KEY_PREFIX}:list:{org_slug}:{page}:{limit}"
        raw = r.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        logger.debug("Courses cache read failed for %s", org_slug, exc_info=True)
    return None


def set_cached_courses_list(org_slug: str, page: int, limit: int, data: list) -> None:
    """Cache public course list for an org."""
    r = get_redis_client()
    if r is None:
        return
    try:
        key = f"{_KEY_PREFIX}:list:{org_slug}:{page}:{limit}"
        r.setex(key, CACHE_TTL_COURSES_LIST, json.dumps(data, default=str))
    except Exception:
        logger.debug("Courses cache write failed for %s", org_slug, exc_info=True)


def invalidate_courses_cache(org_slug: str) -> None:
    """Remove all cached course lists for an org."""
    r = get_redis_client()
    if r is None:
        return
    try:
        # Delete all list keys for this org
        pattern = f"{_KEY_PREFIX}:list:{org_slug}:*"
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
    except Exception:
        logger.debug("Courses cache invalidate failed for %s", org_slug, exc_info=True)


# ── Course meta cache (per course AND per user) ──
#
# The payload carries per-user state: `is_locked` and `unlock_date` on every
# chapter and activity depend on the drip (enrolment date + configured offset)
# and on user groups. Caching it under a key without the user meant whoever
# warmed the cache decided what everybody else saw for the next minute — an
# admin (nothing locked) or a student who signed up earlier. Hence the user in
# the key.

CACHE_TTL_COURSE_META = 60  # 1 min


def _meta_key(course_uuid: str, slim: bool, user_id: int | str | None) -> str:
    suffix = ":slim" if slim else ":full"
    return f"{_KEY_PREFIX}:meta:{course_uuid}{suffix}:u{user_id if user_id is not None else 'anon'}"


def get_cached_course_meta(
    course_uuid: str, slim: bool, user_id: int | str | None = None
) -> Optional[dict]:
    """Return cached course meta for this user, or None."""
    r = get_redis_client()
    if r is None:
        return None
    try:
        raw = r.get(_meta_key(course_uuid, slim, user_id))
        if raw:
            return json.loads(raw)
    except Exception:
        logger.debug("Course meta cache read failed for %s", course_uuid, exc_info=True)
    return None


def set_cached_course_meta(
    course_uuid: str, slim: bool, data: dict, user_id: int | str | None = None
) -> None:
    """Cache course meta for this user."""
    r = get_redis_client()
    if r is None:
        return
    try:
        r.setex(
            _meta_key(course_uuid, slim, user_id),
            CACHE_TTL_COURSE_META,
            json.dumps(data, default=str),
        )
    except Exception:
        logger.debug("Course meta cache write failed for %s", course_uuid, exc_info=True)


def invalidate_course_meta_cache(course_uuid: str) -> None:
    """Remove cached course meta when course is updated."""
    r = get_redis_client()
    if r is None:
        return
    try:
        # Una entrada por usuario: hay que borrarlas todas, no solo dos claves
        # fijas, o el curso editado seguiría saliendo viejo para quien ya lo
        # tuviera cacheado.
        keys = r.keys(f"{_KEY_PREFIX}:meta:{course_uuid}:*")
        if keys:
            r.delete(*keys)
    except Exception:
        logger.debug("Course meta cache invalidate failed for %s", course_uuid, exc_info=True)
