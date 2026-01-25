import argparse
from datetime import datetime

from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import Gender, User, UserRole, VerificationStatus


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", default="admin")
    parser.add_argument("--age", type=int, default=30)
    parser.add_argument("--gender", default="other")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user:
            user.role = UserRole.ADMIN
            user.verification_status = VerificationStatus.VERIFIED
            user.verified_at = datetime.utcnow()
            if not user.username:
                user.username = args.username
            db.add(user)
            db.commit()
            return

        user = User(
            email=args.email,
            username=args.username,
            hashed_password=get_password_hash(args.password),
            full_name=args.full_name,
            age=args.age,
            gender=Gender(args.gender),
            verification_status=VerificationStatus.VERIFIED,
            verified_at=datetime.utcnow(),
            role=UserRole.ADMIN,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
