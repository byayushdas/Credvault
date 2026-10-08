"""Owner-controlled automatic fetching, disabled for all existing documents."""
from alembic import op
import sqlalchemy as sa

revision = 'cv6_document_auto_fetch'
down_revision = '65772979faa1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('cv_credentials', sa.Column('auto_fetch', sa.Boolean(),
        nullable=False, server_default=sa.false()))


def downgrade():
    raise RuntimeError('Destructive downgrade disabled; restore a verified backup instead.')
