import argparse
import os
from typing import Any, Iterable

from sqlalchemy import func, or_

from app.db.session import SessionLocal
from app.models.group import Group
from app.models.membership import JoinStatus, Membership, MembershipRole
from app.models.user import User

DEMO_EMAIL_DOMAIN = os.getenv("DEMO_EMAIL_DOMAIN", "demo.splendoure.com")


def _is_demo_user(user: User) -> bool:
    details = user.profile_details or {}
    if isinstance(details, dict) and details.get("demo_profile") is True:
        return True
    email = user.email or ""
    return "+demo-" in email or email.endswith(f"@{DEMO_EMAIL_DOMAIN}")


def _get_eligible_users(db, scope: str, user_ids: list[int] | None) -> list[User]:
    query = db.query(User).filter(User.deleted_at.is_(None))
    if scope == "ids":
        if not user_ids:
            return []
        return query.filter(User.id.in_(user_ids)).all()
    users = query.all()
    if scope == "demo":
        return [user for user in users if _is_demo_user(user)]
    return users


def _groups_missing_creators(db, only_null: bool) -> list[Group]:
    if only_null:
        return (
            db.query(Group)
            .filter(Group.deleted_at.is_(None), Group.creator_id.is_(None))
            .all()
        )
    return (
        db.query(Group)
        .outerjoin(User, User.id == Group.creator_id)
        .filter(
            Group.deleted_at.is_(None),
            or_(
                Group.creator_id.is_(None),
                User.id.is_(None),
                User.deleted_at.isnot(None),
            ),
        )
        .all()
    )


def _get_group_counts(db, user_ids: Iterable[int]) -> dict[int, int]:
    rows = (
        db.query(Group.creator_id, func.count(Group.id))
        .filter(Group.deleted_at.is_(None), Group.creator_id.in_(list(user_ids)))
        .group_by(Group.creator_id)
        .all()
    )
    return {int(row[0]): int(row[1]) for row in rows if row[0] is not None}


def _ensure_creator_membership(db, group_id: int, user_id: int) -> None:
    membership = (
        db.query(Membership)
        .filter(
            Membership.group_id == group_id,
            Membership.user_id == user_id,
            Membership.deleted_at.is_(None),
        )
        .first()
    )
    if membership:
        membership.role = MembershipRole.CREATOR
        membership.join_status = JoinStatus.APPROVED
        return
    db.add(
        Membership(
            group_id=group_id,
            user_id=user_id,
            role=MembershipRole.CREATOR,
            join_status=JoinStatus.APPROVED,
        )
    )


def _pick_user_with_lowest_count(counts: dict[int, int]) -> int:
    return min(counts, key=counts.get)


def assign_creators(
    *,
    scope: str,
    user_ids: list[int] | None,
    only_null: bool,
    apply: bool,
    limit: int | None,
) -> None:
    db = SessionLocal()
    try:
        eligible_users = _get_eligible_users(db, scope, user_ids)
        if not eligible_users:
            print("No eligible users found for the requested scope.")
            return

        user_id_list = [user.id for user in eligible_users]
        counts = {user_id: 0 for user_id in user_id_list}
        counts.update(_get_group_counts(db, user_id_list))

        groups = _groups_missing_creators(db, only_null=only_null)
        if limit is not None:
            groups = groups[:limit]
        if not groups:
            print("No groups missing creators.")
            return

        updated = 0
        for group in groups:
            user_id = _pick_user_with_lowest_count(counts)
            group.creator_id = user_id
            _ensure_creator_membership(db, group.id, user_id)
            counts[user_id] += 1
            updated += 1

        if apply:
            db.commit()
            print(f"Assigned creators for {updated} groups.")
        else:
            db.rollback()
            print(f"Dry run: would assign creators for {updated} groups. Use --apply to commit.")

        print("Group counts (top 10):")
        for user_id, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:10]:
            print(f"  user_id={user_id} groups={count}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Assign creators to groups missing valid creators.")
    parser.add_argument(
        "--scope",
        choices=["demo", "all", "ids"],
        default="demo",
        help="Which users to use when assigning creators.",
    )
    parser.add_argument(
        "--user-ids",
        default="",
        help="Comma-separated list of user IDs when using --scope ids.",
    )
    parser.add_argument(
        "--only-null",
        action="store_true",
        help="Only fix groups with creator_id IS NULL (skip deleted or missing creators).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit how many groups to update.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes to the database (default is dry run).",
    )
    args = parser.parse_args()

    user_ids = [int(value) for value in args.user_ids.split(",") if value.strip().isdigit()] if args.user_ids else None
    assign_creators(
        scope=args.scope,
        user_ids=user_ids,
        only_null=args.only_null,
        apply=args.apply,
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
