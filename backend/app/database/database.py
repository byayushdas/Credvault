from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from ..core.config import settings

class Base(DeclarativeBase):
    pass

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True,
    connect_args={'check_same_thread': False, 'timeout': 30} if settings.DATABASE_URL.startswith('sqlite') else {})
if engine.dialect.name == 'sqlite':
    @event.listens_for(engine, 'connect')
    def sqlite_constraints(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

SessionLocal = sessionmaker(engine, expire_on_commit=False)

def lock_transaction(db):
    # Establishes a total order across workers for consent, revocation and audit.
    if db.bind.dialect.name == 'postgresql':
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || '.credvault', 0))"))
    else:
        db.execute(text('BEGIN IMMEDIATE'))

def get_db():
    with SessionLocal() as db:
        lock_transaction(db)
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            for undo in db.info.get('file_rollbacks', []):
                undo()
            raise
