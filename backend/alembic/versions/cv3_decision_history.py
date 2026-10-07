"""Preserve decision evidence and bind age assessment metadata to claim proofs."""
from alembic import op
import sqlalchemy as sa

revision = 'cv3_decision_history'
down_revision = 'cv2_connected'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('cv_credentials', sa.Column('assessment_date', sa.String(40), nullable=True))
    op.create_table('cv_decision_history',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('request_id', sa.String(36), sa.ForeignKey('cv_requests.id'), nullable=False),
        sa.Column('field', sa.String(80), nullable=False),
        sa.Column('decision', sa.String(20), nullable=False),
        sa.Column('method', sa.String(20), nullable=False),
        sa.Column('rules', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.String(40), nullable=False))
    op.create_index('ix_cv_decision_history_request_id', 'cv_decision_history', ['request_id'])

def downgrade():
    raise RuntimeError('Destructive downgrade disabled. Restore a verified backup instead.')
