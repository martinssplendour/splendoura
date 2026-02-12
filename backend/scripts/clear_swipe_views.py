import argparse

from app.db.session import SessionLocal
from app.models.swipe_history import SwipeAction, SwipeHistory, SwipeTargetType


def clear_views(*, user_id: int | None, target_type: str, apply: bool) -> None:
    db = SessionLocal()
    try:
        query = db.query(SwipeHistory).filter(SwipeHistory.action == SwipeAction.VIEW)
        if user_id is not None:
            query = query.filter(SwipeHistory.user_id == user_id)
        if target_type != "all":
            query = query.filter(SwipeHistory.target_type == SwipeTargetType(target_type))

        total = query.count()
        if total == 0:
            print("No view records matched the filters.")
            return

        if not apply:
            print(f"Dry run: would delete {total} view records.")
            return

        deleted = query.delete(synchronize_session=False)
        db.commit()
        print(f"Deleted {deleted} view records.")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Clear swipe history view records.")
    parser.add_argument("--user-id", type=int, default=None, help="Only delete views for this user.")
    parser.add_argument(
        "--target-type",
        choices=["group", "profile", "all"],
        default="all",
        help="Limit to group or profile views (default: all).",
    )
    parser.add_argument("--apply", action="store_true", help="Apply deletions (default is dry run).")
    args = parser.parse_args()

    clear_views(user_id=args.user_id, target_type=args.target_type, apply=args.apply)


if __name__ == "__main__":
    main()
