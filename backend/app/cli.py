"""Admin commands. Run them from backend/ with the virtualenv active:

    python -m app.cli make-admin you@example.com     give an account the admin role
    python -m app.cli claim-tasks you@example.com    give ownerless (v1) tasks to an account

Both run the database migrations first, so they work on a database the server hasn't opened yet.
"""

import argparse
import sys

from sqlmodel import Session, col, select, update

from app import db
from app.models import Role, Todo, User


class CommandError(Exception):
    pass


def find_user(session: Session, email: str) -> User:
    user = session.exec(select(User).where(User.email == email.strip().lower())).first()
    if user is None:
        raise CommandError(f"No account with the email {email}. Sign up in the app first.")
    return user


def make_admin(session: Session, email: str) -> str:
    user = find_user(session, email)
    if user.role == Role.admin:
        return f"{user.email} is already an admin."
    user.role = Role.admin
    session.add(user)
    session.commit()
    return f"{user.email} is now an admin."


def claim_tasks(session: Session, email: str) -> int:
    """Give every task without an owner to this account. Returns how many moved."""
    user = find_user(session, email)
    result = session.exec(
        update(Todo).where(col(Todo.owner_id).is_(None)).values(owner_id=user.id)
    )
    session.commit()
    return result.rowcount


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="AI Todo admin commands")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("make-admin", help="give an account the admin role").add_argument("email")
    commands.add_parser(
        "claim-tasks", help="give tasks that have no owner (from v1) to an account"
    ).add_argument("email")
    args = parser.parse_args(argv)

    db.migrate()
    with Session(db.engine) as session:
        try:
            if args.command == "make-admin":
                print(make_admin(session, args.email))
            else:
                moved = claim_tasks(session, args.email)
                print(f"Gave {moved} task{'s' if moved != 1 else ''} to {args.email.lower()}.")
        except CommandError as err:
            print(f"Error: {err}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
