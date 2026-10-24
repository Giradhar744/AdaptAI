from typing import Protocol, Optional
from pydantic import BaseModel, Field


class UploadTarget(BaseModel):
    upload_url: str = Field(description="URL or endpoint to upload the raw video file")
    video_id: str = Field(description="Provider-agnostic reference ID")
    content_type: str = Field(description="MIME type expected")


class VideoStore(Protocol):
    """Abstract interface for video lecture storage and streaming (PROJECT.md §7)."""
    async def create_upload(self, filename: str, content_type: str) -> UploadTarget:
        ...

    def playback_ref(self, video_id: str) -> str:
        ...
