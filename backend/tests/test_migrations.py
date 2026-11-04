import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from app import db


@pytest.fixture
def engine(monkeypatch):
    """A fresh in-memory database that db.migrate() will use."""
    test_engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    monkeypatch.setattr(db, "engine", test_engine)
    return test_engine


def head_revision() -> str:
    return ScriptDirectory.from_config(
        Config(str(db.BACKEND_DIR / "alembic.ini"))
    ).get_current_head()


def current_revision(engine) -> str | None:
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def test_migrate_creates_the_schema_on_an_empty_database(engine):
    db.migrate()

    assert "todo" in inspect(engine).get_table_names()
    assert current_revision(engine) == head_revision()


def test_migrate_is_safe_to_run_twice(engine):
    db.migrate()
    db.migrate()

    assert current_revision(engine) == head_revision()


def test_v1_database_is_stamped_and_keeps_its_tasks(engine):
    # Build a database the way v1 did: the baseline tables, but no alembic_version table.
    with engine.begin() as connection:
        config = Config(str(db.BACKEND_DIR / "alembic.ini"))
        config.attributes["connection"] = connection
        command.upgrade(config, db.BASELINE_REVISION)
        connection.execute(text("DROP TABLE alembic_version"))
        connection.execute(
            text(
                "INSERT INTO todo (id, title, priority, completed, created_at, updated_at) "
                "VALUES (1, 'Made in v1', 'medium', 0, '2026-10-31 10:00:00', "
                "'2026-10-31 10:00:00')"
            )
        )

    db.migrate()

    assert current_revision(engine) == head_revision()
    with engine.connect() as connection:
        titles = connection.execute(text("SELECT title FROM todo")).scalars().all()
    assert titles == ["Made in v1"]


def test_models_and_migrations_match(engine):
    """Fails if a model changed without a matching migration.

    Fix it with: alembic revision --autogenerate -m "describe the change"
    """
    db.migrate()

    with engine.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), SQLModel.metadata)

    assert differences == []
