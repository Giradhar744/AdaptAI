from typing import Optional, List
from pydantic import BaseModel, Field


class TopicResponse(BaseModel):
    id: str
    chapter_id: str
    title: str
    position: int
    content_text: str


class TopicCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content_text: str = Field(min_length=1, description="Source content text for topic DPP generation")
    position: Optional[int] = Field(default=None, ge=1)


class LectureResponse(BaseModel):
    id: str
    chapter_id: str
    title: str
    video_ref: str
    playback_url: str
    duration_seconds: int


class LectureCreateRequest(BaseModel):
    chapter_id: str
    title: str = Field(min_length=1, max_length=200)
    video_ref: str = Field(min_length=1, description="Video ID or storage reference")
    duration_seconds: int = Field(default=0, ge=0)


class LectureUploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1)
    content_type: str = Field(default="video/mp4")


class UploadUrlResponse(BaseModel):
    upload_url: str
    video_id: str
    content_type: str


class ChapterResponse(BaseModel):
    id: str
    course_id: str
    title: str
    position: int
    topics: List[TopicResponse] = Field(default_factory=list)
    lectures: List[LectureResponse] = Field(default_factory=list)


class ChapterCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    position: Optional[int] = Field(default=None, ge=1)


class CourseResponse(BaseModel):
    id: str
    teacher_id: str
    teacher_name: str
    title: str
    subject: str
    age_band_id: str
    age_band_code: str
    age_band_label: str
    description: Optional[str] = None
    is_published: bool
    chapters_count: int = 0


class CourseDetailResponse(CourseResponse):
    chapters: List[ChapterResponse] = Field(default_factory=list)


class CourseCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1, max_length=100)
    age_band_code: str = Field(description="Code for target age band: 7-10, 11-15, 15-20")
    description: Optional[str] = None


class CourseUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    subject: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_published: Optional[bool] = None
