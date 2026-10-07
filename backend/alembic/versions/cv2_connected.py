"""Add connected application tables; preserve all prototype data."""
from alembic import op
from app.database.schema_v2 import Base

revision = 'cv2_connected'
down_revision = 'b1fcf8d05d2f'
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    Base.metadata.create_all(bind)
    if bind.dialect.name == 'postgresql':
        op.execute("""CREATE FUNCTION cv_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Audit records are append-only'; END; $$""")
        op.execute("CREATE TRIGGER cv_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON cv_audit FOR EACH STATEMENT EXECUTE FUNCTION cv_reject_audit_mutation()")
    else:
        op.execute("CREATE TRIGGER cv_audit_no_update BEFORE UPDATE ON cv_audit BEGIN SELECT RAISE(ABORT, 'Audit records are append-only'); END")
        op.execute("CREATE TRIGGER cv_audit_no_delete BEFORE DELETE ON cv_audit BEGIN SELECT RAISE(ABORT, 'Audit records are append-only'); END")

def downgrade():
    raise RuntimeError('Destructive downgrade disabled. Restore a verified backup instead.')
