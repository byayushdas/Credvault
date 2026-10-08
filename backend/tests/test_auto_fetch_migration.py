import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text


def test_auto_fetch_migration_is_the_single_head():
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / 'alembic.ini'))
    config.set_main_option('script_location', str(backend / 'alembic'))
    scripts = ScriptDirectory.from_config(config)
    assert scripts.get_heads() == ['cv6_document_auto_fetch']
    assert scripts.get_revision('cv6_document_auto_fetch').down_revision == '65772979faa1'


def test_migration_defaults_existing_documents_to_off(env):
    # Recreate the previous column layout only inside this fixture's isolated
    # schema; exercise the actual migration against existing credential rows.
    path = Path(__file__).resolve().parents[1] / 'alembic/versions/cv6_document_auto_fetch.py'
    spec = importlib.util.spec_from_file_location('auto_fetch_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with env['engine'].begin() as connection:
        before = connection.execute(text('SELECT id, signature, claims_encrypted FROM cv_credentials ORDER BY id')).all()
        assert before
        connection.execute(text('ALTER TABLE cv_credentials DROP COLUMN auto_fetch'))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert connection.execute(text('SELECT id, signature, claims_encrypted FROM cv_credentials ORDER BY id')).all() == before
        assert connection.execute(text('SELECT DISTINCT auto_fetch FROM cv_credentials')).scalars().all() == [False]
        column = next(c for c in inspect(connection).get_columns('cv_credentials') if c['name'] == 'auto_fetch')
        assert column['nullable'] is False
        assert column['default'] == 'false'
