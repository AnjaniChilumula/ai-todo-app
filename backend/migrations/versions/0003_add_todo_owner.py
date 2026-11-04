"""Give every task an owner (todo.owner_id -> users.id).

Existing v1 tasks keep owner_id = NULL until `python -m app.cli claim-tasks <email>`.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-04
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Named explicitly: SQLite constraints have no names otherwise, and downgrade must refer to it.
OWNER_FK = "fk_todo_owner_id_users"


def upgrade() -> None:
    with op.batch_alter_table("todo") as batch_op:
        batch_op.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f("ix_todo_owner_id"), ["owner_id"], unique=False)
        batch_op.create_foreign_key(OWNER_FK, "users", ["owner_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("todo") as batch_op:
        batch_op.drop_constraint(OWNER_FK, type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_todo_owner_id"))
        batch_op.drop_column("owner_id")
