"""add_share_token

Revision ID: 65772979faa1
Revises: 9bfaf9631dec
Create Date: 2026-10-07 21:24:31.250431

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '65772979faa1'
down_revision: Union[str, Sequence[str], None] = '9bfaf9631dec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('cv_share_tokens',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('vault_id', sa.String(length=39), nullable=False),
    sa.Column('verifier_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.String(length=40), nullable=False),
    sa.Column('expires_at', sa.String(length=40), nullable=False),
    sa.Column('consumed', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['cv_users.id'], ),
    sa.ForeignKeyConstraint(['verifier_id'], ['cv_organizations.id'], ),
    sa.PrimaryKeyConstraint('token_hash')
    )
    op.create_index(op.f('ix_cv_share_tokens_owner_id'), 'cv_share_tokens', ['owner_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_cv_share_tokens_owner_id'), table_name='cv_share_tokens')
    op.drop_table('cv_share_tokens')
