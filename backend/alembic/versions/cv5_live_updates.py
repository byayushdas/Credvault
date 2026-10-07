"""Transactional user-scoped live-update cursors."""
from alembic import op
import sqlalchemy as sa
revision = 'cv5_live_updates'
down_revision = 'cv4_proof_context'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('cv_live_revisions',
        sa.Column('user_id', sa.String(36), sa.ForeignKey('cv_users.id'), primary_key=True),
        sa.Column('revision', sa.Integer(), nullable=False, server_default='0'))

def downgrade():
    raise RuntimeError('Destructive downgrade disabled; restore a verified backup instead.')
