from typing import Optional
from app.core.config import settings
from app.video.base import VideoStore
from app.video.providers.fake import FakeVideoStore


def get_video_store(provider_name: Optional[str] = None) -> VideoStore:
    name = (provider_name or settings.VIDEO_PROVIDER).lower()
    return FakeVideoStore()
