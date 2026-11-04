"""Add users.google_sub, Google's stable id for an account that signs in with Google.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-04
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("google_sub", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True)
        )
        batch_op.create_index(batch_op.f("ix_users_google_sub"), ["google_sub"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_google_sub"))
        batch_op.drop_column("google_sub")
