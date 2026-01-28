from sqlalchemy.orm import Session

from app.models.match_request import MatchRequest, MatchRequestInvite
from app.schemas.match_request import MatchRequestCreate


class CRUDMatchRequest:
    def create(self, db: Session, *, requester_id: int, obj_in: MatchRequestCreate) -> MatchRequest:
        db_obj = MatchRequest(
            requester_id=requester_id,
            intent=obj_in.intent.value if hasattr(obj_in.intent, "value") else str(obj_in.intent),
            criteria=[criterion.model_dump() for criterion in obj_in.criteria] if obj_in.criteria else [],
            offers=obj_in.offers or [],
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get(self, db: Session, *, request_id: int) -> MatchRequest | None:
        return (
            db.query(MatchRequest)
            .filter(MatchRequest.id == request_id, MatchRequest.deleted_at.is_(None))
            .first()
        )


class CRUDMatchInvite:
    def create(
        self,
        db: Session,
        *,
        request_id: int,
        requester_id: int,
        target_user_id: int,
    ) -> MatchRequestInvite:
        db_obj = MatchRequestInvite(
            request_id=request_id,
            requester_id=requester_id,
            target_user_id=target_user_id,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_existing(
        self,
        db: Session,
        *,
        request_id: int,
        target_user_id: int,
    ) -> MatchRequestInvite | None:
        return (
            db.query(MatchRequestInvite)
            .filter(
                MatchRequestInvite.request_id == request_id,
                MatchRequestInvite.target_user_id == target_user_id,
                MatchRequestInvite.deleted_at.is_(None),
            )
            .first()
        )


match_request = CRUDMatchRequest()
match_invite = CRUDMatchInvite()
