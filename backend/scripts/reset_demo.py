"""Reset database script for development."""
from sqlalchemy import text, create_engine
from app.core.config import settings

def main():
    if settings.ENVIRONMENT != 'development':
        raise RuntimeError('Database reset is allowed only in development')
    
    url = settings.MIGRATION_DATABASE_URL or settings.DATABASE_URL
    admin_engine = create_engine(url)
    
    with admin_engine.begin() as conn:
        tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name != 'alembic_version'")).fetchall()
        table_names = [t[0] for t in tables]
        if table_names:
            conn.execute(text("ALTER TABLE cv_audit DISABLE TRIGGER USER"))
            conn.execute(text(f"TRUNCATE TABLE {','.join(table_names)} CASCADE"))
            conn.execute(text("ALTER TABLE cv_audit ENABLE TRIGGER USER"))
        print("Development database reset successfully.")

if __name__ == '__main__':
    main()
