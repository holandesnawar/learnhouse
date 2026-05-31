"""
Course banner image upload.

The banner is a wide hero image (≈21:9) shown at the top of the course
detail page when a student opens it. Separate from `thumbnail_image`
(16:9) which is used in the course listing cards.

Banners are stored alongside thumbnails on disk but kept in their own
subfolder and tracked in `course.extra_metadata["banner_image"]` (a
JSONB column), so no DB migration is needed to add the field.
"""

from fastapi import UploadFile

from src.services.utils.upload_content import upload_file


async def upload_banner(banner_file: UploadFile, org_uuid: str, course_uuid: str) -> str:
    """Upload a course banner image with file validation."""
    return await upload_file(
        file=banner_file,
        directory=f"courses/{course_uuid}/banners",
        type_of_dir="orgs",
        uuid=org_uuid,
        allowed_types=["image"],
        filename_prefix="banner",
    )
