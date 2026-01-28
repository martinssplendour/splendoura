from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core.matching import compute_match_score, is_profile_visible

router = APIRouter()


@router.post("/requests", response_model=schemas.MatchRequestWithResults)
def create_match_request(
    *,
    db: Session = Depends(deps.get_db),
    payload: schemas.MatchRequestCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    request = crud.match_request.create(db, requester_id=current_user.id, obj_in=payload)

    candidates = (
        db.query(models.User)
        .filter(models.User.deleted_at.is_(None), models.User.id != current_user.id)
        .all()
    )
    results: List[schemas.MatchCandidate] = []
    criteria_list = [criterion.model_dump() for criterion in payload.criteria] if payload.criteria else []

    for candidate in candidates:
        if not is_profile_visible(candidate):
            continue
        match_count, total, score = compute_match_score(current_user, candidate, criteria_list)
        results.append(
            schemas.MatchCandidate(
                user=candidate,
                match_count=match_count,
                criteria_count=total,
                score=score,
            )
        )

    results.sort(
        key=lambda item: (
            item.match_count,
            item.score,
            item.user.last_active_at or item.user.created_at,
        ),
        reverse=True,
    )

    return schemas.MatchRequestWithResults(request=request, results=results)


@router.post("/requests/{request_id}/send/{user_id}", response_model=schemas.MatchInvite)
def send_match_request(
    *,
    db: Session = Depends(deps.get_db),
    request_id: int,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    request = crud.match_request.get(db, request_id=request_id)
    if not request or request.requester_id != current_user.id:
        raise HTTPException(status_code=404, detail="Match request not found.")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send a request to yourself.")
    existing = crud.match_invite.get_existing(db, request_id=request_id, target_user_id=user_id)
    if existing:
        return existing
    invite = crud.match_invite.create(
        db,
        request_id=request_id,
        requester_id=current_user.id,
        target_user_id=user_id,
    )
    return invite
