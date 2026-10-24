from typing import List
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_student
from app.core.security import decode_access_token
from app.schemas.struggle import (
    BehaviourSignalCreate,
    BehaviourSignalResponse,
    TelemetryBatchRequest,
    StruggleAssessRequest,
    StruggleAssessmentResponse,
)
from app.services.struggle_service import StruggleService
from app.core.logging import logger

router = APIRouter(tags=["Telemetry & Struggle Detection"])


@router.post("/telemetry/signals", response_model=List[BehaviourSignalResponse], status_code=status.HTTP_201_CREATED)
async def record_telemetry_signals(
    req: TelemetryBatchRequest,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Ingests behavioural signals (latency, hesitation, error patterns, hint requests) from the student client."""
    return await StruggleService.record_signals_batch(
        session=session,
        student_id=current_student.student_profile.id,
        signals=req.signals,
    )


@router.post("/struggle/assess", response_model=StruggleAssessmentResponse)
async def assess_session_struggle(
    req: StruggleAssessRequest,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Evaluates real-time struggle score and risk level, returning proactive support proposals."""
    return await StruggleService.assess_struggle(
        session=session,
        current_user=current_student,
        session_ref=req.session_ref,
        extra_signals=req.signals,
    )


@router.get("/students/{id}/struggle/history", response_model=List[StruggleAssessmentResponse])
async def get_student_struggle_history(
    id: str,
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves chronological struggle assessment history for an enrolled student."""
    return await StruggleService.get_struggle_history(session=session, student_id=id, limit=limit)


@router.websocket("/ws/session")
async def websocket_session_telemetry(
    websocket: WebSocket,
    session: AsyncSession = Depends(get_db),
):
    """
    Real-time bidirectional WebSocket connection (PROJECT.md §13) for streaming
    behavioural telemetry from student frontend and pushing struggle interventions.
    """
    await websocket.accept()
    authenticated_user: User | None = None

    try:
        # First message must be auth token or initial handshake
        auth_msg = await websocket.receive_text()
        data = json.loads(auth_msg)
        token = data.get("token")
        if not token:
            await websocket.send_json({"type": "error", "message": "Authentication token required"})
            await websocket.close(code=1008)
            return

        payload = decode_access_token(token)
        if not payload:
            await websocket.send_json({"type": "error", "message": "Invalid or expired token"})
            await websocket.close(code=1008)
            return

        user_id = payload.get("sub")
        res = await session.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.student_profile))
        )
        user = res.scalar_one_or_none()
        if not user or not user.student_profile:
            await websocket.send_json({"type": "error", "message": "Student account required"})
            await websocket.close(code=1008)
            return
        authenticated_user = user

        await websocket.send_json({"type": "authenticated", "student_id": authenticated_user.student_profile.id})

        # Main message loop
        while True:
            text_data = await websocket.receive_text()
            msg = json.loads(text_data)
            action_type = msg.get("type")

            if action_type == "signal":
                # Real-time signal record
                signal_create = BehaviourSignalCreate(
                    session_ref=msg.get("session_ref", "default-session"),
                    signal_type=msg.get("signal_type"),
                    value=msg.get("value", {}),
                )
                res = await StruggleService.record_signals_batch(
                    session,
                    authenticated_user.student_profile.id,
                    [signal_create],
                )
                await websocket.send_json({"type": "signal_ack", "signal_id": res[0].id})

            elif action_type == "assess":
                session_ref = msg.get("session_ref", "default-session")
                assessment = await StruggleService.assess_struggle(
                    session,
                    authenticated_user,
                    session_ref=session_ref,
                )
                await websocket.send_json({
                    "type": "struggle_assessment",
                    "data": assessment.model_dump(),
                })

            elif action_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info("WebSocket telemetry client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
