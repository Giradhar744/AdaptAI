import uuid
from app.video.base import VideoStore, UploadTarget


class FakeVideoStore:
    """Deterministic, provider-agnostic video store for development and testing (PROJECT.md §7)."""

    async def create_upload(self, filename: str, content_type: str) -> UploadTarget:
        video_id = f"vid_{uuid.uuid4().hex[:12]}"
        return UploadTarget(
            upload_url=f"/api/v1/mock-uploads/{video_id}/{filename}",
            video_id=video_id,
            content_type=content_type,
        )

    def playback_ref(self, video_id: str) -> str:
        return f"/api/v1/videos/{video_id}/stream.mp4"
