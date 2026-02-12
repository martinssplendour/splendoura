# backend/app/crud/crud_group.py
from datetime import datetime, timezone
from sqlalchemy import and_, exists, or_
from sqlalchemy.orm import Session
from app.models.group import AppliesTo, Group, GroupRequirement
from app.models.swipe_history import SwipeHistory, SwipeTargetType
from app.schemas.group import GroupCreate

class CRUDGroup:
    def get(self, db: Session, id: int):
        """Fetch a single group by ID."""
        return db.query(Group).filter(Group.id == id, Group.deleted_at.is_(None)).first()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100):
        """Fetch multiple groups for the browse page."""
        return db.query(Group).filter(Group.deleted_at.is_(None)).offset(skip).limit(limit).all()

    def get_multi_filtered(
        self,
        db: Session,
        *,
        creator_id: int | None = None,
        location: str | None = None,
        activity_type: str | None = None,
        category: str | None = None,
        cost_type: str | None = None,
        tags: list[str] | None = None,
        search: str | None = None,
        gender: str | None = None,
        min_age: int | None = None,
        max_age: int | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        exclude_swipe_user_id: int | None = None,
        exclude_group_ids=None,
        cursor: tuple[datetime, int] | None = None,
        skip: int = 0,
        limit: int = 100,
    ):
        query = db.query(Group).filter(Group.deleted_at.is_(None))
        if exclude_swipe_user_id is not None:
            query = query.filter(
                ~exists().where(
                    and_(
                        SwipeHistory.user_id == exclude_swipe_user_id,
                        SwipeHistory.target_type == SwipeTargetType.GROUP,
                        SwipeHistory.target_id == Group.id,
                    )
                )
            )
        if exclude_group_ids is not None:
            query = query.filter(~Group.id.in_(exclude_group_ids))
        if creator_id is not None:
            query = query.filter(Group.creator_id == creator_id)
        if search:
            query = query.filter(
                Group.title.ilike(f"%{search}%") | Group.description.ilike(f"%{search}%")
            )
        if location:
            query = query.filter(Group.location.ilike(f"%{location}%"))
        if activity_type:
            query = query.filter(Group.activity_type == activity_type)
        if category:
            query = query.filter(Group.category == category)
        if cost_type:
            query = query.filter(Group.cost_type == cost_type)
        if tags:
            for tag in tags:
                query = query.filter(Group.tags.contains([tag]))
        if start_date:
            query = query.filter(Group.start_date >= start_date)
        if end_date:
            query = query.filter(Group.end_date <= end_date)
        if gender or min_age or max_age:
            query = query.join(GroupRequirement).filter(GroupRequirement.deleted_at.is_(None))
            if gender:
                query = query.filter(GroupRequirement.applies_to.in_([gender, AppliesTo.ALL]))
            if min_age is not None:
                query = query.filter(GroupRequirement.min_age <= min_age)
            if max_age is not None:
                query = query.filter(GroupRequirement.max_age >= max_age)
        query = query.order_by(Group.created_at.desc(), Group.id.desc())
        if cursor:
            cursor_created_at, cursor_id = cursor
            if cursor_created_at.tzinfo is None:
                cursor_created_at = cursor_created_at.replace(tzinfo=timezone.utc)
            query = query.filter(
                or_(
                    Group.created_at < cursor_created_at,
                    and_(Group.created_at == cursor_created_at, Group.id < cursor_id),
                )
            )
            return query.limit(limit).all()
        return query.offset(skip).limit(limit).all()

    def create_with_owner(self, db: Session, *, obj_in: GroupCreate, owner_id: int) -> Group:
        """Create a group and its requirements linked to the creator."""
        # 1. Create the main Group entry
        db_obj = Group(
            title=obj_in.title,
            description=obj_in.description,
            activity_type=obj_in.activity_type,
            location=obj_in.location,
            location_lat=obj_in.location_lat,
            location_lng=obj_in.location_lng,
            destination=obj_in.destination,
            start_date=obj_in.start_date,
            end_date=obj_in.end_date,
            min_participants=obj_in.min_participants,
            cost_type=obj_in.cost_type,
            offerings=obj_in.offerings,
            rules=obj_in.rules,
            expectations=obj_in.expectations,
            tags=obj_in.tags,
            creator_intro=obj_in.creator_intro,
            creator_intro_video_url=obj_in.creator_intro_video_url,
            category=obj_in.category,
            visibility=obj_in.visibility,
            max_participants=obj_in.max_participants,
            creator_id=owner_id
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        # 2. Add each requirement provided in the list
        for req in obj_in.requirements:
            db_requirement = GroupRequirement(
                group_id=db_obj.id,
                applies_to=req.applies_to,
                min_age=req.min_age,
                max_age=req.max_age,
                additional_requirements=req.additional_requirements,
                consent_flags=req.consent_flags
            )
            db.add(db_requirement)
        
        db.commit()
        db.refresh(db_obj)
        return db_obj

group = CRUDGroup()
