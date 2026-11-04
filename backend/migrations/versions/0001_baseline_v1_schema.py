"""Baseline: the v1 schema (the todo table).

Databases created by v1 (with SQLModel's create_all) already have this table; app/db.py marks
them as being at this revision instead of creating it again.

Revision ID: 0001
Revises:
Create Date: 2026-11-04
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "todo",
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("due_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("priority", sa.Enum("low", "medium", "high", name="priority"), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["todo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("todo") as batch_op:
        batch_op.create_index(batch_op.f("ix_todo_parent_id"), ["parent_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("todo") as batch_op:
        batch_op.drop_index(batch_op.f("ix_todo_parent_id"))
    op.drop_table("todo")
