"""Alembic environment: how migrations connect to the database."""

from alembic import context
from sqlalchemy import create_engine
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registers every table on SQLModel.metadata)
from app.config import get_settings

target_metadata = SQLModel.metadata


def run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # SQLite can't ALTER most things in place; batch mode rebuilds the table instead.
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# The app passes its own connection (see app/db.py) so tests can use an in-memory database.
# When run from the command line (`alembic upgrade head`) we connect using the app's settings.
connection = context.config.attributes.get("connection")
if connection is not None:
    run_migrations(connection)
else:
    engine = create_engine(get_settings().database_url)
    with engine.begin() as conn:
        run_migrations(conn)
