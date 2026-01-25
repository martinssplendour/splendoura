# backend/app/crud/crud_membership.py
from sqlalchemy.orm import Session
from app.models.membership import Membership
from app.schemas.membership import MembershipCreate

class CRUDMembership:
    def get_by_user_and_group(self, db: Session, user_id: int, group_id: int):
        return db.query(Membership).filter(
            Membership.user_id == user_id, 
            Membership.group_id == group_id,
            Membership.deleted_at.is_(None)
        ).first()

    def create(self, db: Session, *, obj_in: MembershipCreate):
        db_obj = Membership(
            user_id=obj_in.user_id,
            group_id=obj_in.group_id,
            role=obj_in.role,
            join_status=obj_in.join_status,
            request_message=obj_in.request_message,
            request_tier=obj_in.request_tier,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update_status(self, db: Session, membership: Membership, join_status: str):
        membership.join_status = join_status
        db.add(membership)
        db.commit()
        db.refresh(membership)
        return membership

    def list_members_by_group(self, db: Session, group_id: int):
        return db.query(Membership).filter(
            Membership.group_id == group_id,
            Membership.deleted_at.is_(None)
        ).all()

membership = CRUDMembership()
