"""Bind signing time in new proofs; preserve previous signatures."""
from alembic import op
import sqlalchemy as sa
revision = 'cv4_proof_context'
down_revision = 'cv3_decision_history'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('cv_credentials', sa.Column('proof_version', sa.Integer(), nullable=False, server_default='1'))

def downgrade():
    raise RuntimeError('Destructive downgrade disabled. Restore a verified backup instead.')
