from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user
from app.schemas.consent import (
    ConsentDecisionRequest,
    ConsentLedgerItem,
    PendingProposalResponse,
    TrustProfileResponse,
    StudentPreferenceResponse,
    RevokePreferenceRequest,
    CreateProposalRequest,
)
from app.services.consent_service import ConsentService

router = APIRouter(tags=["Consent & Trust Ledger"])


@router.get("/students/{id}/consent/pending", response_model=List[PendingProposalResponse])
async def get_pending_consent_proposals(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves all pending adaptation proposals formatted in transparent, age-appropriate plain language."""
    return await ConsentService.get_pending_proposals(session=session, current_user=current_user, student_id=id)


@router.post("/consent/{ledger_id}/decide", response_model=ConsentLedgerItem)
async def record_consent_decision(
    ledger_id: str,
    req: ConsentDecisionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Records a student or parent decision on a proposed adaptation.
    Strictly appends a new decision row referencing supersedes_id (Append-Only guarantee).
    """
    return await ConsentService.record_decision(
        session=session,
        current_user=current_user,
        ledger_id=ledger_id,
        decision=req.decision,
        decided_by=req.decided_by,
    )


@router.get("/students/{id}/consent/history", response_model=List[ConsentLedgerItem])
async def get_consent_history(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves the full append-only Consent Ledger audit trail for an enrolled student."""
    return await ConsentService.get_consent_history(session=session, current_user=current_user, student_id=id)


@router.get("/students/{id}/preferences", response_model=List[StudentPreferenceResponse])
async def get_student_preferences(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves all active student preferences established through past consent approvals."""
    return await ConsentService.get_student_preferences(session=session, current_user=current_user, student_id=id)


@router.post("/students/{id}/consent/revoke", response_model=ConsentLedgerItem)
async def revoke_student_preference(
    id: str,
    req: RevokePreferenceRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Revokes a previously approved adaptation preference, appending a superseding revocation row to the ledger."""
    return await ConsentService.revoke_preference(
        session=session,
        current_user=current_user,
        student_id=id,
        preference_key=req.preference_key,
        decided_by=req.decided_by,
    )


@router.get("/students/{id}/trust-profile", response_model=TrustProfileResponse)
async def get_student_trust_profile(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves cooperation metrics, acceptance rates, and nagging reduction factor for a student profile."""
    return await ConsentService.get_trust_profile(session=session, current_user=current_user, student_id=id)


@router.post("/students/{id}/consent/propose", response_model=PendingProposalResponse, status_code=status.HTTP_201_CREATED)
async def propose_adaptation(
    id: str,
    req: CreateProposalRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Generates a new pending adaptation proposal in the append-only Consent Ledger."""
    return await ConsentService.create_proposal(
        session=session,
        current_user=current_user,
        student_id=id,
        proposal_type=req.proposal_type,
        payload=req.payload,
        agent=req.proposed_by_agent,
        priority_class=req.priority_class,
        rationale=req.rationale or "Pedagogical adaptation proposal",
    )

