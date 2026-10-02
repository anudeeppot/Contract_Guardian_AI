"""
Alembic migration: add pgvector, activity_logs, risk_findings, contract_versions,
reports, tags, contract_tags, contract_embeddings, and update existing tables
for full CO1-CO6 compliance.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002_full_schema'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable extensions (PostgreSQL only)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # Create enum types safely
    op.execute("""
        DO $$ BEGIN
          CREATE TYPE activity_type AS ENUM (
            'USER_LOGIN','USER_LOGOUT','USER_SIGNUP',
            'CONTRACT_UPLOAD','CONTRACT_DELETE','CONTRACT_VIEW',
            'ANALYSIS_START','ANALYSIS_COMPLETE',
            'REPORT_GENERATE','VECTOR_SEARCH','RAG_QUERY'
          );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)

    op.execute("""
        DO $$ BEGIN
          CREATE TYPE risk_level_enum AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)

    # Add missing columns to contracts table
    with op.batch_alter_table('contracts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('title', sa.String(500), nullable=True))
        batch_op.add_column(sa.Column('contract_type', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('effective_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('expiry_date', sa.Date(), nullable=True))

    # Add missing columns to analyses table
    with op.batch_alter_table('analyses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('model_used', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('tokens_used', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('analysis_duration_ms', sa.Integer(), nullable=True))

    # Create activity_logs table
    op.create_table(
        'activity_logs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_activity_logs_user_id', 'activity_logs', ['user_id'])
    op.create_index('idx_activity_logs_type', 'activity_logs', ['activity_type'])
    op.create_index('idx_activity_logs_created_at', 'activity_logs', ['created_at'])

    # Create risk_findings table
    op.create_table(
        'risk_findings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('analysis_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('finding_type', sa.String(100), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('location', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_risk_findings_analysis_id', 'risk_findings', ['analysis_id'])

    # Create contract_versions table
    op.create_table(
        'contract_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contract_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('storage_path', sa.Text(), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('sha256', sa.CHAR(64), nullable=False),
        sa.Column('change_notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', 'version_number'),
    )

    # Create reports table
    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contract_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('analysis_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False, server_default='PDF'),
        sa.Column('storage_path', sa.Text(), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_reports_contract_id', 'reports', ['contract_id'])
    op.create_index('idx_reports_user_id', 'reports', ['user_id'])

    # Create tags table
    op.create_table(
        'tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(20), nullable=False, server_default='#6366f1'),
        sa.UniqueConstraint('name'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create contract_tags join table
    op.create_table(
        'contract_tags',
        sa.Column('contract_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('contract_id', 'tag_id'),
    )

    # Create contract_embeddings table (pgvector)
    op.create_table(
        'contract_embeddings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contract_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('chunk_text', sa.Text(), nullable=False),
        sa.Column('embedding', sa.Text(), nullable=True),  # stored as text, cast to vector
        sa.Column('metadata', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', 'chunk_index'),
    )
    op.create_index('idx_contract_embeddings_contract_id', 'contract_embeddings', ['contract_id'])

    # Create full-text search index on contracts
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_contracts_text_search
        ON contracts USING gin(to_tsvector('english', COALESCE(extracted_text, '')))
    """)

    # Create trgm index for title search
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_contracts_title_trgm
        ON contracts USING gin(COALESCE(title, original_filename) gin_trgm_ops)
    """)

    # Create activity log trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS
        $$
        BEGIN
            NEW.updated_at := NOW();
            RETURN NEW;
        END;
        $$
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
        CREATE TRIGGER trg_contracts_updated_at
            BEFORE UPDATE ON contracts
            FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
        CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
    """)

    # Trigger: log contract uploads
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_log_contract_upload()
        RETURNS TRIGGER LANGUAGE plpgsql AS
        $$
        BEGIN
            INSERT INTO activity_logs (user_id, activity_type, entity_type, entity_id, description)
            VALUES (NEW.user_id, 'CONTRACT_UPLOAD', 'contract', NEW.id,
                    'Contract uploaded: ' || NEW.original_filename);
            RETURN NEW;
        END;
        $$
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_log_contract_upload ON contracts;
        CREATE TRIGGER trg_log_contract_upload
            AFTER INSERT ON contracts
            FOR EACH ROW EXECUTE FUNCTION fn_log_contract_upload()
    """)

    # Trigger: log analysis completion
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_log_analysis_complete()
        RETURNS TRIGGER LANGUAGE plpgsql AS
        $$
        BEGIN
            INSERT INTO activity_logs
                (user_id, activity_type, entity_type, entity_id, description, metadata)
            VALUES (
                NEW.user_id, 'ANALYSIS_COMPLETE', 'analysis', NEW.id,
                'Analysis completed. Risk: ' || NEW.contract_risk_score || ' (' || NEW.risk_level || ')',
                jsonb_build_object('risk_score', NEW.contract_risk_score, 'risk_level', NEW.risk_level)
            );
            RETURN NEW;
        END;
        $$
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_log_analysis_complete ON analyses;
        CREATE TRIGGER trg_log_analysis_complete
            AFTER INSERT ON analyses
            FOR EACH ROW EXECUTE FUNCTION fn_log_analysis_complete()
    """)

    # Dashboard view
    op.execute("""
        CREATE OR REPLACE VIEW v_contract_dashboard AS
        SELECT
            u.id              AS user_id,
            u.email           AS user_email,
            u.full_name,
            COUNT(DISTINCT c.id)  AS total_contracts,
            COUNT(DISTINCT a.id)  AS total_analyses,
            ROUND(AVG(a.contract_risk_score), 2) AS avg_risk_score,
            MAX(a.contract_risk_score)             AS max_risk_score,
            COUNT(DISTINCT c.id) FILTER (WHERE a.risk_level = 'CRITICAL') AS critical_contracts,
            COUNT(DISTINCT c.id) FILTER (WHERE a.risk_level = 'HIGH')     AS high_risk_contracts,
            MAX(c.created_at)   AS last_upload
        FROM users u
        LEFT JOIN contracts c ON c.user_id = u.id
        LEFT JOIN analyses  a ON a.contract_id = c.id
        GROUP BY u.id, u.email, u.full_name
    """)

    # Risk summary view with window functions
    op.execute("""
        CREATE OR REPLACE VIEW v_risk_summary AS
        SELECT
            c.id              AS contract_id,
            c.original_filename,
            c.user_id,
            a.id              AS analysis_id,
            a.contract_risk_score,
            a.risk_level,
            a.created_at      AS analysis_date,
            RANK()       OVER (PARTITION BY c.user_id ORDER BY a.contract_risk_score DESC) AS risk_rank,
            DENSE_RANK() OVER (PARTITION BY c.user_id ORDER BY a.contract_risk_score DESC) AS dense_risk_rank,
            ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY a.created_at DESC)          AS recency_rank
        FROM contracts c
        JOIN analyses a ON a.contract_id = c.id
    """)

    # Seed default tags
    op.execute("""
        INSERT INTO tags (name, color) VALUES
            ('High Risk','#ef4444'), ('Employment','#3b82f6'),
            ('NDA','#8b5cf6'), ('SaaS','#06b6d4'),
            ('Investment','#f59e0b'), ('Supply Chain','#10b981'),
            ('Vendor','#f97316'), ('Partnership','#84cc16')
        ON CONFLICT (name) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table('contract_tags')
    op.drop_table('contract_embeddings')
    op.drop_table('tags')
    op.drop_table('reports')
    op.drop_table('contract_versions')
    op.drop_table('risk_findings')
    op.drop_table('activity_logs')
    op.execute("DROP VIEW IF EXISTS v_risk_summary")
    op.execute("DROP VIEW IF EXISTS v_contract_dashboard")
    op.execute("DROP FUNCTION IF EXISTS fn_log_analysis_complete() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS fn_log_contract_upload() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS fn_set_updated_at() CASCADE")
