from alembic import context
from app.core.config import settings
from app.database.database import engine, Base
from app.models import records
from sqlalchemy import create_engine
config = context.config
target_metadata = Base.metadata
if context.is_offline_mode():
    context.configure(url=settings.DATABASE_URL, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    migration_engine = create_engine(settings.MIGRATION_DATABASE_URL) if settings.MIGRATION_DATABASE_URL else engine
    with migration_engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
