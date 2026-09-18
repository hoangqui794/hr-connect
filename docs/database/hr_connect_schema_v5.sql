-- ============================================================
-- HR CONNECT - POSTGRESQL PHYSICAL SCHEMA v5 INSTALL SCRIPT
-- Fresh install: v4 baseline + v5 integrity hardening.
-- PostgreSQL 15+
--
-- psql CLI recommendation:
--   psql -v ON_ERROR_STOP=1 -f hr_connect_schema_v5_install.sql
-- ============================================================

BEGIN;

-- ============================================================
-- HR CONNECT - POSTGRESQL PHYSICAL SCHEMA v4 INSTALL SCRIPT
-- Fresh install: original v3 schema followed by v4 hardening patch.
-- PostgreSQL 15+
-- ============================================================

-- ============================================================
-- HR CONNECT - POSTGRESQL PHYSICAL SCHEMA v3
-- Multi-role + CV Builder/Templates + AI Job-Fit Notifications
-- PostgreSQL 15+
--
-- Core decisions:
-- 1) One app_user = one login identity.
-- 2) One app_user can have multiple roles via user_role.
-- 3) Candidate may later become Affiliate without a new account.
-- 4) Candidate CV supports:
--      PLATFORM_BUILDER
--      TEMPLATE_FORM
--      FILE_UPLOAD
-- 5) AI has two distinct use cases:
--      a) candidate_job_match = pre-application job-fit recommendation
--      b) ai_match_result = post-submission/application screening support
-- 6) notification stores in-app notifications, including JOB_FIT.
-- 7) Affiliate self-attribution is prohibited.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS hr_connect;
SET search_path TO hr_connect, public;

-- ============================================================
-- COMMON
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================
-- 1. IDENTITY / AUTHORIZATION
-- ============================================================

CREATE TABLE app_user (
    user_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email                varchar(255) NOT NULL,
    password_hash        varchar(255) NOT NULL,
    display_name         varchar(255),
    phone                varchar(30),
    normalized_phone     varchar(30),
    avatar_url           text,
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','ACTIVE','LOCKED','SUSPENDED')),
    email_verified_at    timestamptz,
    last_login_at        timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_app_user_email_ci ON app_user (lower(email));
CREATE INDEX idx_app_user_normalized_phone ON app_user (normalized_phone)
WHERE normalized_phone IS NOT NULL;
CREATE INDEX idx_app_user_status ON app_user (status);

CREATE TRIGGER trg_app_user_updated_at
BEFORE UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE role (
    role_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 varchar(60) NOT NULL UNIQUE,
    name                 varchar(120) NOT NULL,
    description          text,
    is_system            boolean NOT NULL DEFAULT true,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_role_updated_at
BEFORE UPDATE ON role
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE permission (
    permission_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 varchar(120) NOT NULL UNIQUE,
    resource             varchar(100) NOT NULL,
    action               varchar(60) NOT NULL,
    description          text,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_permission_updated_at
BEFORE UPDATE ON permission
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE user_role (
    user_id              uuid NOT NULL,
    role_id              uuid NOT NULL,
    assigned_by          uuid,
    assignment_source    varchar(40) NOT NULL DEFAULT 'SYSTEM'
                         CHECK (assignment_source IN (
                            'REGISTRATION',
                            'AFFILIATE_APPROVAL',
                            'COMPANY_VERIFICATION',
                            'ADMIN_PROVISIONING',
                            'SYSTEM'
                         )),
    assigned_at          timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, role_id),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_user_role_role_id ON user_role (role_id);


CREATE TABLE role_permission (
    role_id              uuid NOT NULL,
    permission_id        uuid NOT NULL,
    granted_at           timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (role_id, permission_id),

    FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permission(permission_id) ON DELETE RESTRICT
);

-- ============================================================
-- 2. AUTHENTICATION / TOKENS / EMAIL OUTBOX
-- ============================================================

CREATE TABLE user_token (
    token_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL,
    token_type           varchar(40) NOT NULL
                         CHECK (token_type IN ('EMAIL_OTP','EMAIL_VERIFY','PASSWORD_RESET')),
    token_hash           varchar(255) NOT NULL,
    expires_at           timestamptz NOT NULL,
    used_at              timestamptz,
    attempt_count        integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    created_by_ip        inet,
    created_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_token_lookup
ON user_token (user_id, token_type, expires_at DESC);

CREATE INDEX idx_user_token_active
ON user_token (user_id, token_type, expires_at)
WHERE used_at IS NULL;


CREATE TABLE refresh_token (
    refresh_token_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL,
    token_hash           varchar(255) NOT NULL UNIQUE,
    expires_at           timestamptz NOT NULL,
    revoked_at           timestamptz,
    replaced_by_token_id uuid,
    created_by_ip        inet,
    revoked_by_ip        inet,
    revoke_reason        varchar(255),
    created_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE CASCADE,
    FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_token(refresh_token_id) ON DELETE SET NULL
);

CREATE INDEX idx_refresh_token_active
ON refresh_token (user_id, expires_at DESC)
WHERE revoked_at IS NULL;


CREATE TABLE email_outbox (
    email_outbox_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid,
    recipient_email      varchar(255) NOT NULL,
    template_code        varchar(80) NOT NULL,
    subject              varchar(255),
    payload              jsonb NOT NULL DEFAULT '{}'::jsonb,
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
    retry_count          integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    next_retry_at        timestamptz,
    sent_at              timestamptz,
    last_error           text,
    created_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_email_outbox_pending
ON email_outbox (status, next_retry_at, created_at)
WHERE status IN ('PENDING','FAILED');

-- ============================================================
-- 3. CANDIDATE PROFILE / SKILLS / CV
-- ============================================================

CREATE TABLE candidate (
    candidate_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid UNIQUE,
    full_name            varchar(255) NOT NULL,
    email                varchar(255),
    phone                varchar(30),
    normalized_email     varchar(255),
    normalized_phone     varchar(30),
    date_of_birth        date,
    gender               varchar(30),
    current_address      text,
    highest_education    varchar(120),
    years_of_experience  numeric(5,2)
                         CHECK (years_of_experience IS NULL OR years_of_experience >= 0),
    summary              text,
    profile_visibility   varchar(30) NOT NULL DEFAULT 'PRIVATE'
                         CHECK (profile_visibility IN ('PRIVATE','LIMITED','VISIBLE')),
    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','INACTIVE','MERGED','ARCHIVED')),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_candidate_normalized_email ON candidate (normalized_email)
WHERE normalized_email IS NOT NULL;
CREATE INDEX idx_candidate_normalized_phone ON candidate (normalized_phone)
WHERE normalized_phone IS NOT NULL;

CREATE TRIGGER trg_candidate_updated_at
BEFORE UPDATE ON candidate
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE skill (
    skill_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name           varchar(120) NOT NULL,
    normalized_name      varchar(120) NOT NULL UNIQUE,
    category             varchar(120),
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE candidate_skill (
    candidate_id         uuid NOT NULL,
    skill_id             uuid NOT NULL,
    proficiency_level    varchar(40),
    years_of_experience  numeric(5,2)
                         CHECK (years_of_experience IS NULL OR years_of_experience >= 0),

    PRIMARY KEY (candidate_id, skill_id),

    FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skill(skill_id) ON DELETE RESTRICT
);


CREATE TABLE cv_template (
    cv_template_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 varchar(80) NOT NULL UNIQUE,
    name                 varchar(150) NOT NULL,
    description          text,
    preview_url          text,
    template_config      jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cv_template_updated_at
BEFORE UPDATE ON cv_template
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE candidate_cv (
    cv_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id         uuid NOT NULL,

    title                varchar(180) NOT NULL,
    creation_method      varchar(40) NOT NULL
                         CHECK (creation_method IN (
                            'PLATFORM_BUILDER',
                            'TEMPLATE_FORM',
                            'FILE_UPLOAD'
                         )),

    cv_template_id       uuid,

    structured_content   jsonb,
    parsed_data          jsonb,

    source_file_url      text,
    rendered_file_url    text,

    file_name            varchar(255),
    mime_type            varchar(120),
    file_size_bytes      bigint
                         CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),

    is_primary           boolean NOT NULL DEFAULT false,

    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),

    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON DELETE RESTRICT,
    FOREIGN KEY (cv_template_id) REFERENCES cv_template(cv_template_id) ON DELETE SET NULL,

    CONSTRAINT ck_candidate_cv_creation_method
    CHECK (
        (creation_method = 'PLATFORM_BUILDER'
            AND structured_content IS NOT NULL)
        OR
        (creation_method = 'TEMPLATE_FORM'
            AND structured_content IS NOT NULL
            AND cv_template_id IS NOT NULL)
        OR
        (creation_method = 'FILE_UPLOAD'
            AND source_file_url IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_candidate_primary_cv
ON candidate_cv (candidate_id)
WHERE is_primary = true AND status = 'ACTIVE';

CREATE INDEX idx_candidate_cv_candidate
ON candidate_cv (candidate_id, created_at DESC);

CREATE INDEX idx_candidate_cv_creation_method
ON candidate_cv (creation_method, status);

CREATE TRIGGER trg_candidate_cv_updated_at
BEFORE UPDATE ON candidate_cv
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. AFFILIATE
-- ============================================================

CREATE TABLE affiliate_application (
    affiliate_application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL,
    affiliate_type       varchar(50) NOT NULL DEFAULT 'RECRUITER'
                         CHECK (affiliate_type IN ('RECRUITER','OPR_HUB')),
    display_name         varchar(180),
    tax_information      varchar(255),
    contact_person       varchar(180),
    phone                varchar(30),
    address              text,
    submitted_data       jsonb NOT NULL DEFAULT '{}'::jsonb,
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED')),
    reviewed_by          uuid,
    review_note          text,
    submitted_at         timestamptz NOT NULL DEFAULT now(),
    reviewed_at          timestamptz,

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX uq_affiliate_application_open
ON affiliate_application (user_id)
WHERE status IN ('PENDING','UNDER_REVIEW');


CREATE TABLE affiliate_profile (
    affiliate_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL UNIQUE,
    affiliate_type       varchar(50) NOT NULL DEFAULT 'RECRUITER'
                         CHECK (affiliate_type IN ('RECRUITER','OPR_HUB')),
    display_name         varchar(180),
    tax_information      varchar(255),
    contact_person       varchar(180),
    phone                varchar(30),
    address              text,
    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','SUSPENDED','INACTIVE')),
    verified_at          timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_affiliate_profile_updated_at
BEFORE UPDATE ON affiliate_profile
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. INTERNAL HR / ADMIN
-- ============================================================

CREATE TABLE internal_hr_profile (
    hr_profile_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL UNIQUE,
    employee_code        varchar(50) UNIQUE,
    department           varchar(120),
    job_title            varchar(120),
    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_internal_hr_profile_updated_at
BEFORE UPDATE ON internal_hr_profile
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE admin_profile (
    admin_profile_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL UNIQUE,
    employee_code        varchar(50) UNIQUE,
    job_title            varchar(120),
    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_admin_profile_updated_at
BEFORE UPDATE ON admin_profile
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. COMPANY / CLIENT
-- ============================================================

CREATE TABLE company (
    company_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name         varchar(255) NOT NULL,
    tax_code             varchar(80),
    industry             varchar(120),
    company_size         varchar(50),
    website              varchar(255),
    address              text,
    description          text,
    verification_status  varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (verification_status IN ('PENDING','UNDER_REVIEW','VERIFIED','REJECTED','SUSPENDED')),
    verified_at          timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_company_tax_code ON company (tax_code)
WHERE tax_code IS NOT NULL;

CREATE TRIGGER trg_company_updated_at
BEFORE UPDATE ON company
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE company_user (
    company_user_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           uuid NOT NULL,
    user_id              uuid NOT NULL,
    role_in_company      varchar(120),
    is_primary_contact   boolean NOT NULL DEFAULT false,
    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    UNIQUE (company_id, user_id),

    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_company_primary_contact
ON company_user (company_id)
WHERE is_primary_contact = true AND status = 'ACTIVE';

CREATE TRIGGER trg_company_user_updated_at
BEFORE UPDATE ON company_user
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE company_verification_request (
    company_verification_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           uuid NOT NULL,
    submitted_by         uuid NOT NULL,
    reviewed_by          uuid,
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED')),
    submitted_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
    review_note          text,
    submitted_at         timestamptz NOT NULL DEFAULT now(),
    reviewed_at          timestamptz,

    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by) REFERENCES app_user(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

-- ============================================================
-- 7. SERVICE TYPE / JOB
-- ============================================================

CREATE TABLE service_type (
    service_type_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 varchar(50) NOT NULL UNIQUE,
    name                 varchar(120) NOT NULL,
    description          text,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_service_type_updated_at
BEFORE UPDATE ON service_type
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE job (
    job_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           uuid NOT NULL,
    service_type_id      uuid NOT NULL,
    created_by           uuid NOT NULL,
    title                varchar(255) NOT NULL,
    description          text,
    location             varchar(255),
    employment_type      varchar(50),
    salary_min           numeric(18,2),
    salary_max           numeric(18,2),
    currency_code        char(3) NOT NULL DEFAULT 'VND',
    quantity             integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    status               varchar(30) NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','ACTIVE','PAUSED','REJECTED','CLOSED')),
    posted_at            timestamptz,
    closed_at            timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min),

    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE RESTRICT,
    FOREIGN KEY (service_type_id) REFERENCES service_type(service_type_id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES app_user(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_job_company_status ON job (company_id, status);
CREATE INDEX idx_job_service_type_status ON job (service_type_id, status);
CREATE INDEX idx_job_active ON job (company_id, service_type_id, posted_at DESC)
WHERE status = 'ACTIVE';

CREATE TRIGGER trg_job_updated_at
BEFORE UPDATE ON job
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE job_requirement (
    requirement_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id               uuid NOT NULL,
    requirement_type     varchar(30) NOT NULL
                         CHECK (requirement_type IN ('MUST_HAVE','SHOULD_HAVE')),
    category             varchar(120),
    content              text NOT NULL,
    weight               numeric(8,4) CHECK (weight IS NULL OR weight >= 0),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (job_id) REFERENCES job(job_id) ON DELETE CASCADE
);

CREATE TRIGGER trg_job_requirement_updated_at
BEFORE UPDATE ON job_requirement
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE job_skill (
    job_id               uuid NOT NULL,
    skill_id             uuid NOT NULL,
    is_mandatory         boolean NOT NULL DEFAULT false,
    weight               numeric(8,4) CHECK (weight IS NULL OR weight >= 0),

    PRIMARY KEY (job_id, skill_id),

    FOREIGN KEY (job_id) REFERENCES job(job_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skill(skill_id) ON DELETE RESTRICT
);

-- ============================================================
-- 8. PRE-APPLICATION AI JOB MATCHING / NOTIFICATION
-- ============================================================

CREATE TABLE candidate_job_match (
    candidate_job_match_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    candidate_id         uuid NOT NULL,
    job_id               uuid NOT NULL,
    cv_id                uuid,

    attempt_no           integer NOT NULL DEFAULT 1 CHECK (attempt_no > 0),

    match_score          numeric(5,2)
                         CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),

    match_tier           varchar(30),

    match_summary        jsonb,
    matching_reasons     jsonb,
    missing_requirements jsonb,

    status               varchar(30) NOT NULL DEFAULT 'GENERATED'
                         CHECK (status IN ('GENERATED','NOTIFIED','EXPIRED','FAILED')),

    generated_at         timestamptz NOT NULL DEFAULT now(),
    expires_at           timestamptz,

    created_at           timestamptz NOT NULL DEFAULT now(),

    UNIQUE (candidate_id, job_id, attempt_no),

    FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON DELETE RESTRICT,
    FOREIGN KEY (job_id) REFERENCES job(job_id) ON DELETE RESTRICT,
    FOREIGN KEY (cv_id) REFERENCES candidate_cv(cv_id) ON DELETE SET NULL
);

CREATE INDEX idx_candidate_job_match_candidate_score
ON candidate_job_match (candidate_id, match_score DESC, generated_at DESC);

CREATE INDEX idx_candidate_job_match_job
ON candidate_job_match (job_id, generated_at DESC);


CREATE TABLE notification (
    notification_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL,

    notification_type    varchar(50) NOT NULL
                         CHECK (notification_type IN (
                            'JOB_FIT',
                            'APPLICATION_STATUS',
                            'INTERVIEW',
                            'OFFER',
                            'AFFILIATE',
                            'COMMISSION',
                            'PAYOUT',
                            'SYSTEM'
                         )),

    title                varchar(255) NOT NULL,
    message              text NOT NULL,

    related_entity_type  varchar(60),
    related_entity_id    uuid,

    metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,

    is_read              boolean NOT NULL DEFAULT false,
    read_at              timestamptz,

    created_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_notification_unread
ON notification (user_id, created_at DESC)
WHERE is_read = false;

CREATE INDEX idx_notification_user_created
ON notification (user_id, created_at DESC);

-- ============================================================
-- 9. SUBMISSION / DUPLICATE / APPLICATION
-- ============================================================

CREATE TABLE submission (
    submission_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id         uuid NOT NULL,
    cv_id                uuid NOT NULL,
    job_id               uuid NOT NULL,
    submitted_by         uuid NOT NULL,
    source               varchar(30) NOT NULL
                         CHECK (source IN ('CANDIDATE','AFFILIATE','INTERNAL_HR')),
    status               varchar(40) NOT NULL DEFAULT 'RECEIVED'
                         CHECK (status IN ('RECEIVED','ACCEPTED','BLOCKED_DUPLICATE','REJECTED_INVALID','CANCELLED')),
    duplicate_of_submission_id uuid,
    note                 text,
    submitted_at         timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON DELETE RESTRICT,
    FOREIGN KEY (cv_id) REFERENCES candidate_cv(cv_id) ON DELETE RESTRICT,
    FOREIGN KEY (job_id) REFERENCES job(job_id) ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by) REFERENCES app_user(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (duplicate_of_submission_id) REFERENCES submission(submission_id) ON DELETE SET NULL
);

CREATE INDEX idx_submission_job_candidate
ON submission (job_id, candidate_id, submitted_at);

CREATE INDEX idx_submission_submitted_by
ON submission (submitted_by, submitted_at DESC);

CREATE TRIGGER trg_submission_updated_at
BEFORE UPDATE ON submission
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE application (
    application_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id               uuid NOT NULL,
    candidate_id         uuid NOT NULL,
    accepted_submission_id uuid,
    status               varchar(40) NOT NULL DEFAULT 'SUBMITTED'
                         CHECK (status IN (
                            'SUBMITTED','SCREENING','SHORTLISTED','REJECTED',
                            'INTERVIEW','BACKUP','INTERVIEW_FAILED',
                            'OFFER_PENDING','OFFER_ACCEPTED','OFFER_DECLINED',
                            'NOT_STARTED','PLACED','CLOSED'
                         )),
    current_stage        varchar(50),
    applied_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    UNIQUE (candidate_id, job_id),

    FOREIGN KEY (job_id) REFERENCES job(job_id) ON DELETE RESTRICT,
    FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON DELETE RESTRICT,
    FOREIGN KEY (accepted_submission_id) REFERENCES submission(submission_id) ON DELETE RESTRICT
);

CREATE INDEX idx_application_job_status ON application (job_id, status);
CREATE INDEX idx_application_candidate ON application (candidate_id, updated_at DESC);

CREATE TRIGGER trg_application_updated_at
BEFORE UPDATE ON application
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 10. POST-APPLICATION AI SCREENING
-- ============================================================

CREATE TABLE ai_match_result (
    match_result_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id       uuid NOT NULL,
    attempt_no           integer NOT NULL DEFAULT 1 CHECK (attempt_no > 0),
    match_score          numeric(5,2)
                         CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
    match_tier           varchar(30),
    candidate_highlight  jsonb,
    must_have_result     jsonb,
    should_have_result   jsonb,
    raw_response         jsonb,
    external_reference   varchar(255),
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','PROCESSING','SUCCESS','FAILED','UNAVAILABLE')),
    error_message        text,
    requested_at         timestamptz NOT NULL DEFAULT now(),
    completed_at         timestamptz,

    UNIQUE (application_id, attempt_no),

    FOREIGN KEY (application_id) REFERENCES application(application_id) ON DELETE RESTRICT
);

CREATE INDEX idx_ai_match_application
ON ai_match_result (application_id, attempt_no DESC);

-- ============================================================
-- 11. INTERVIEW
-- ============================================================

CREATE TABLE interview (
    interview_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id       uuid NOT NULL,
    interview_round      integer NOT NULL DEFAULT 1 CHECK (interview_round > 0),
    interview_type       varchar(50),
    scheduled_at         timestamptz,
    duration_minutes     integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    location             varchar(255),
    meeting_link         text,
    status               varchar(30) NOT NULL DEFAULT 'SCHEDULED'
                         CHECK (status IN ('SCHEDULED','RESCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
    result               varchar(30)
                         CHECK (result IS NULL OR result IN ('PASS','FAIL','BACKUP')),
    feedback             text,
    created_by           uuid,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    UNIQUE (application_id, interview_round),

    FOREIGN KEY (application_id) REFERENCES application(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE TRIGGER trg_interview_updated_at
BEFORE UPDATE ON interview
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 12. OFFER / PLACEMENT / PROBATION / WARRANTY
-- ============================================================

CREATE TABLE offer (
    offer_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id       uuid NOT NULL,
    offer_version        integer NOT NULL DEFAULT 1 CHECK (offer_version > 0),
    salary               numeric(18,2) CHECK (salary IS NULL OR salary >= 0),
    currency_code        char(3) NOT NULL DEFAULT 'VND',
    start_date           date,
    expiry_date          date,
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('DRAFT','PENDING','SENT','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
    created_by           uuid,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    UNIQUE (application_id, offer_version),

    FOREIGN KEY (application_id) REFERENCES application(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE TRIGGER trg_offer_updated_at
BEFORE UPDATE ON offer
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE offer_approval (
    approval_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id             uuid NOT NULL,
    user_id              uuid NOT NULL,
    approval_type        varchar(50),
    status               varchar(30) NOT NULL
                         CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    comment              text,
    created_at           timestamptz NOT NULL DEFAULT now(),

    UNIQUE (offer_id, user_id),

    FOREIGN KEY (offer_id) REFERENCES offer(offer_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT
);


CREATE TABLE placement (
    placement_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id       uuid NOT NULL UNIQUE,
    offer_id             uuid NOT NULL UNIQUE,
    actual_start_date    date NOT NULL,
    position             varchar(180),
    department           varchar(180),
    status               varchar(30) NOT NULL DEFAULT 'STARTED'
                         CHECK (status IN ('STARTED','ACTIVE','ENDED','CANCELLED')),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (application_id) REFERENCES application(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (offer_id) REFERENCES offer(offer_id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_placement_updated_at
BEFORE UPDATE ON placement
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE probation (
    probation_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_id         uuid NOT NULL UNIQUE,
    start_date           date NOT NULL,
    end_date             date,
    result               varchar(30)
                         CHECK (result IS NULL OR result IN ('PASSED','FAILED','EXTENDED','LEFT')),
    notes                text,
    updated_by           uuid,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (placement_id) REFERENCES placement(placement_id) ON DELETE RESTRICT,
    FOREIGN KEY (updated_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE TRIGGER trg_probation_updated_at
BEFORE UPDATE ON probation
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE warranty (
    warranty_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_id         uuid NOT NULL UNIQUE,
    start_date           date NOT NULL,
    end_date             date,
    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','PASSED','FAILED','CANCELLED')),
    result_note          text,
    updated_by           uuid,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (placement_id) REFERENCES placement(placement_id) ON DELETE RESTRICT,
    FOREIGN KEY (updated_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE TRIGGER trg_warranty_updated_at
BEFORE UPDATE ON warranty
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 13. ATTRIBUTION / SELF-ATTRIBUTION PROTECTION
-- ============================================================

CREATE TABLE attribution (
    attribution_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id       uuid NOT NULL UNIQUE,
    affiliate_id         uuid NOT NULL,
    winning_submission_id uuid NOT NULL UNIQUE,
    attribution_rule     varchar(100) NOT NULL
                         DEFAULT 'FIRST_SUBMISSION_TIMESTAMP_PRECEDENCE',
    status               varchar(30) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','DISPUTED','REVOKED')),
    established_at       timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (application_id) REFERENCES application(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (affiliate_id) REFERENCES affiliate_profile(affiliate_id) ON DELETE RESTRICT,
    FOREIGN KEY (winning_submission_id) REFERENCES submission(submission_id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_attribution_updated_at
BEFORE UPDATE ON attribution
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE OR REPLACE FUNCTION prevent_self_affiliate_attribution()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_affiliate_user_id   uuid;
    v_candidate_user_id   uuid;
    v_affiliate_email     varchar(255);
    v_affiliate_phone     varchar(30);
    v_candidate_email     varchar(255);
    v_candidate_phone     varchar(30);
    v_submission_user_id  uuid;
BEGIN
    SELECT ap.user_id, lower(au.email), au.normalized_phone
      INTO v_affiliate_user_id, v_affiliate_email, v_affiliate_phone
      FROM affiliate_profile ap
      JOIN app_user au ON au.user_id = ap.user_id
     WHERE ap.affiliate_id = NEW.affiliate_id;

    SELECT c.user_id, lower(c.normalized_email), c.normalized_phone
      INTO v_candidate_user_id, v_candidate_email, v_candidate_phone
      FROM application a
      JOIN candidate c ON c.candidate_id = a.candidate_id
     WHERE a.application_id = NEW.application_id;

    SELECT submitted_by
      INTO v_submission_user_id
      FROM submission
     WHERE submission_id = NEW.winning_submission_id;

    IF v_submission_user_id IS DISTINCT FROM v_affiliate_user_id THEN
        RAISE EXCEPTION 'Invalid attribution: winning submission was not submitted by affiliate';
    END IF;

    IF v_candidate_user_id IS NOT NULL
       AND v_candidate_user_id = v_affiliate_user_id THEN
        RAISE EXCEPTION 'Self-attribution is not allowed';
    END IF;

    IF v_candidate_email IS NOT NULL
       AND v_affiliate_email IS NOT NULL
       AND v_candidate_email = v_affiliate_email THEN
        RAISE EXCEPTION 'Self-attribution is not allowed: email match';
    END IF;

    IF v_candidate_phone IS NOT NULL
       AND v_affiliate_phone IS NOT NULL
       AND v_candidate_phone = v_affiliate_phone THEN
        RAISE EXCEPTION 'Self-attribution is not allowed: phone match';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_self_affiliate_attribution
BEFORE INSERT OR UPDATE OF application_id, affiliate_id, winning_submission_id
ON attribution
FOR EACH ROW
EXECUTE FUNCTION prevent_self_affiliate_attribution();

-- ============================================================
-- 14. COMMISSION / PAYOUT
-- ============================================================

CREATE TABLE commission_rule (
    commission_rule_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type_id      uuid NOT NULL,
    name                 varchar(180) NOT NULL,
    milestone_type       varchar(60),
    rate_type            varchar(30)
                         CHECK (rate_type IS NULL OR rate_type IN ('PERCENTAGE','FIXED')),
    rate_value           numeric(18,4)
                         CHECK (rate_value IS NULL OR rate_value >= 0),
    warranty_required    boolean NOT NULL DEFAULT false,
    effective_from       timestamptz,
    effective_to         timestamptz,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),

    FOREIGN KEY (service_type_id) REFERENCES service_type(service_type_id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_commission_rule_updated_at
BEFORE UPDATE ON commission_rule
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE commission (
    commission_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attribution_id       uuid NOT NULL,
    placement_id         uuid NOT NULL,
    commission_rule_id   uuid,
    milestone_type       varchar(60),
    base_amount          numeric(18,2)
                         CHECK (base_amount IS NULL OR base_amount >= 0),
    amount               numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN (
                            'PENDING','ELIGIBLE','ON_HOLD','APPROVED',
                            'ADJUSTED','REJECTED','PAYABLE','PAID','CANCELLED'
                         )),
    adjustment_reason    text,
    approved_by          uuid,
    approved_at          timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (attribution_id) REFERENCES attribution(attribution_id) ON DELETE RESTRICT,
    FOREIGN KEY (placement_id) REFERENCES placement(placement_id) ON DELETE RESTRICT,
    FOREIGN KEY (commission_rule_id) REFERENCES commission_rule(commission_rule_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE TRIGGER trg_commission_updated_at
BEFORE UPDATE ON commission
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE payout (
    payout_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id        uuid NOT NULL,
    amount               numeric(18,2) NOT NULL CHECK (amount > 0),
    payout_date          timestamptz,
    method               varchar(50),
    transaction_reference varchar(255),
    evidence_url         text,
    status               varchar(30) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
    recorded_by          uuid,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (commission_id) REFERENCES commission(commission_id) ON DELETE RESTRICT,
    FOREIGN KEY (recorded_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE TRIGGER trg_payout_updated_at
BEFORE UPDATE ON payout
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 15. DISPUTE
-- ============================================================

CREATE TABLE dispute (
    dispute_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_type         varchar(40) NOT NULL
                         CHECK (dispute_type IN ('DUPLICATE','ATTRIBUTION','COMMISSION')),
    submission_id        uuid,
    attribution_id       uuid,
    commission_id        uuid,
    raised_by            uuid NOT NULL,
    description          text NOT NULL,
    evidence             jsonb NOT NULL DEFAULT '[]'::jsonb,
    status               varchar(30) NOT NULL DEFAULT 'OPEN'
                         CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','REJECTED','CANCELLED')),
    resolved_by          uuid,
    resolution           text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    resolved_at          timestamptz,
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CHECK (
        (CASE WHEN submission_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN attribution_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN commission_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    ),

    FOREIGN KEY (submission_id) REFERENCES submission(submission_id) ON DELETE RESTRICT,
    FOREIGN KEY (attribution_id) REFERENCES attribution(attribution_id) ON DELETE RESTRICT,
    FOREIGN KEY (commission_id) REFERENCES commission(commission_id) ON DELETE RESTRICT,
    FOREIGN KEY (raised_by) REFERENCES app_user(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (resolved_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE TRIGGER trg_dispute_updated_at
BEFORE UPDATE ON dispute
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 16. AUDIT / STATUS HISTORY
-- ============================================================

CREATE TABLE audit_log (
    audit_log_id         bigserial PRIMARY KEY,
    actor_user_id        uuid,
    action               varchar(120) NOT NULL,
    entity_type          varchar(80),
    entity_id            uuid,
    old_values           jsonb,
    new_values           jsonb,
    correlation_id       uuid,
    ip_address           inet,
    user_agent           text,
    created_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (actor_user_id) REFERENCES app_user(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_log_entity
ON audit_log (entity_type, entity_id, created_at DESC);


CREATE TABLE application_status_history (
    application_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id       uuid NOT NULL,
    old_status           varchar(40),
    new_status           varchar(40) NOT NULL,
    changed_by           uuid,
    reason               text,
    changed_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (application_id) REFERENCES application(application_id) ON DELETE RESTRICT,
    FOREIGN KEY (changed_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);


CREATE TABLE job_status_history (
    job_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id               uuid NOT NULL,
    old_status           varchar(30),
    new_status           varchar(30) NOT NULL,
    changed_by           uuid,
    reason               text,
    changed_at           timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (job_id) REFERENCES job(job_id) ON DELETE RESTRICT,
    FOREIGN KEY (changed_by) REFERENCES app_user(user_id) ON DELETE SET NULL
);

-- ============================================================
-- 17. SEED DATA
-- ============================================================

INSERT INTO service_type (code, name, description)
VALUES
    ('HEADHUNT_COD', 'Headhunt COD', 'Commission-based headhunting service'),
    ('CV_SOURCING', 'CV Sourcing', 'Candidate CV sourcing service'),
    ('CV_APPLICATION', 'CV Application', 'Open candidate application service')
ON CONFLICT (code) DO NOTHING;


INSERT INTO role (code, name, description, is_system)
VALUES
    ('CANDIDATE', 'Candidate', 'Candidate / job seeker capability', true),
    ('CLIENT_COMPANY_USER', 'Client Company User', 'Authorized client company capability', true),
    ('AFFILIATE_RECRUITER', 'Affiliate Recruiter', 'Affiliate recruiter / OPR Hub capability', true),
    ('INTERNAL_HR', 'Internal HR / Recruiter', 'Internal recruitment operator capability', true),
    ('PLATFORM_ADMIN', 'Platform Admin', 'Platform administration capability', true)
ON CONFLICT (code) DO NOTHING;


INSERT INTO cv_template (code, name, description, template_config)
VALUES
    ('BASIC_01', 'Basic Professional', 'Default professional CV template', '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- NOTES
-- ============================================================

COMMENT ON TABLE app_user IS
'One login identity. A user may simultaneously hold multiple roles through user_role.';

COMMENT ON TABLE candidate_cv IS
'Supports PLATFORM_BUILDER, TEMPLATE_FORM and FILE_UPLOAD CV creation methods.';

COMMENT ON TABLE candidate_job_match IS
'Pre-application AI job-fit result used to recommend jobs to candidates. Distinct from ai_match_result.';

COMMENT ON TABLE ai_match_result IS
'Post-application AI screening support for HR/Client. AI does not make final hiring decisions.';

COMMENT ON TABLE notification IS
'In-app notification store. JOB_FIT notifications may reference a Job through related_entity_type/related_entity_id.';

COMMENT ON TABLE affiliate_application IS
'Existing Candidate can apply to become Affiliate without creating a new app_user.';

COMMENT ON TABLE attribution IS
'Affiliate self-attribution is prohibited. PostgreSQL trigger enforces account/email/phone identity checks.';

COMMENT ON TABLE offer_approval IS
'PROPOSED. Remove if the team does not implement a separate offer approval workflow.';

-- ============================================================
-- END OF HR CONNECT SCHEMA v3
-- ============================================================

-- ============================================================
-- HR CONNECT - v3 -> v4 BASELINE HARDENING PATCH
-- PostgreSQL 15+
--
-- Purpose:
-- - Keep the team's current domain model.
-- - Harden multi-role lifecycle, duplicate concurrency, cross-table integrity,
--   attribution, commission/payout auditability, and affiliate performance.
-- - Keep D16 job-fit and D17 rating policy explicit as pending/optional.
--
-- IMPORTANT:
-- This patch assumes the v3 schema has been created first.
-- For an existing database with production data, review migration comments
-- before applying constraints that tighten existing values.
-- ============================================================

SET search_path TO hr_connect, public;

-- ============================================================
-- P01. ACTOR CONTEXT FOR AUDIT / HISTORY
-- ============================================================

CREATE OR REPLACE FUNCTION current_actor_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_value text;
BEGIN
    v_value := current_setting('hr_connect.current_user_id', true);
    IF v_value IS NULL OR btrim(v_value) = '' THEN
        RETURN NULL;
    END IF;
    RETURN v_value::uuid;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION current_actor_user_id() IS
'Optional actor context. ASP.NET Core may SET LOCAL hr_connect.current_user_id = <uuid> inside a transaction before audited writes.';


-- ============================================================
-- P02. MULTI-ROLE LIFECYCLE
-- ============================================================

ALTER TABLE user_role
    ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN revoked_at timestamptz,
    ADD COLUMN revoked_by uuid,
    ADD COLUMN revoke_reason text;

ALTER TABLE user_role
    ADD CONSTRAINT ck_user_role_status
        CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
    ADD CONSTRAINT ck_user_role_revocation
        CHECK (
            (status <> 'REVOKED' AND revoked_at IS NULL)
            OR
            (status = 'REVOKED' AND revoked_at IS NOT NULL)
        ),
    ADD CONSTRAINT fk_user_role_revoked_by
        FOREIGN KEY (revoked_by) REFERENCES app_user(user_id) ON DELETE SET NULL;

CREATE INDEX idx_user_role_active_user
ON user_role (user_id, role_id)
WHERE status = 'ACTIVE';

COMMENT ON TABLE user_role IS
'Role ownership/lifecycle. Candidate and Affiliate may coexist on the same app_user. Other multi-role combinations remain subject to business policy.';


-- ============================================================
-- P03. CANDIDATE IDENTITY / MERGE SAFETY
-- ============================================================

ALTER TABLE candidate
    ADD COLUMN merged_into_candidate_id uuid;

ALTER TABLE candidate
    ADD CONSTRAINT fk_candidate_merged_into
        FOREIGN KEY (merged_into_candidate_id)
        REFERENCES candidate(candidate_id) ON DELETE RESTRICT,
    ADD CONSTRAINT ck_candidate_not_merge_self
        CHECK (merged_into_candidate_id IS NULL OR merged_into_candidate_id <> candidate_id),
    ADD CONSTRAINT ck_candidate_merge_target_required
        CHECK (
            (status = 'MERGED' AND merged_into_candidate_id IS NOT NULL)
            OR
            (status <> 'MERGED' AND merged_into_candidate_id IS NULL)
        );

DROP INDEX IF EXISTS idx_candidate_normalized_email;
DROP INDEX IF EXISTS idx_candidate_normalized_phone;

-- Current MF-02 duplicate identity rule: exact normalized email OR exact normalized phone.
-- MERGED/ARCHIVED rows do not own the canonical identity.
CREATE UNIQUE INDEX uq_candidate_identity_email
ON candidate (normalized_email)
WHERE normalized_email IS NOT NULL
  AND status IN ('ACTIVE','INACTIVE');

CREATE UNIQUE INDEX uq_candidate_identity_phone
ON candidate (normalized_phone)
WHERE normalized_phone IS NOT NULL
  AND status IN ('ACTIVE','INACTIVE');

CREATE INDEX idx_candidate_status
ON candidate (status);


-- ============================================================
-- P04. CV OWNERSHIP INTEGRITY
-- ============================================================

ALTER TABLE candidate_cv
    ADD CONSTRAINT uq_candidate_cv_owner UNIQUE (candidate_id, cv_id);

-- candidate_job_match is OPTIONAL D16.
-- If it uses a CV, that CV must belong to the same Candidate.
ALTER TABLE candidate_job_match
    DROP CONSTRAINT IF EXISTS candidate_job_match_cv_id_fkey;

ALTER TABLE candidate_job_match
    ADD CONSTRAINT fk_candidate_job_match_cv_owner
        FOREIGN KEY (candidate_id, cv_id)
        REFERENCES candidate_cv(candidate_id, cv_id)
        ON DELETE RESTRICT;


-- ============================================================
-- P05. AFFILIATE PERFORMANCE / QUALITY RATING SUPPORT
-- ============================================================

CREATE TABLE affiliate_performance (
    affiliate_performance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id             uuid NOT NULL,
    period_start             date NOT NULL,
    period_end               date NOT NULL,

    total_submissions        integer NOT NULL DEFAULT 0 CHECK (total_submissions >= 0),
    total_shortlisted        integer NOT NULL DEFAULT 0 CHECK (total_shortlisted >= 0),
    total_interviews         integer NOT NULL DEFAULT 0 CHECK (total_interviews >= 0),
    total_placements         integer NOT NULL DEFAULT 0 CHECK (total_placements >= 0),

    -- Stored as 0..1. Formula is based on actual outcomes, not raw volume.
    submission_to_hire_rate numeric(7,4)
                            CHECK (
                                submission_to_hire_rate IS NULL
                                OR (submission_to_hire_rate >= 0 AND submission_to_hire_rate <= 1)
                            ),

    -- D17: nullable until the team/supervisor confirms a rating formula.
    quality_rating          numeric(7,4)
                            CHECK (quality_rating IS NULL OR quality_rating >= 0),
    rating_label            varchar(50),
    calculation_version     varchar(50),

    calculated_at           timestamptz NOT NULL DEFAULT now(),
    created_at              timestamptz NOT NULL DEFAULT now(),

    CHECK (period_end >= period_start),
    CHECK (total_shortlisted <= total_submissions),
    CHECK (total_interviews <= total_submissions),
    CHECK (total_placements <= total_submissions),

    UNIQUE (affiliate_id, period_start, period_end),

    FOREIGN KEY (affiliate_id)
        REFERENCES affiliate_profile(affiliate_id) ON DELETE RESTRICT
);

CREATE INDEX idx_affiliate_performance_affiliate_period
ON affiliate_performance (affiliate_id, period_end DESC);

COMMENT ON TABLE affiliate_performance IS
'D17-ready performance snapshot. submission_to_hire_rate is supported; quality_rating stays nullable until the rating formula is approved.';


-- ============================================================
-- P06. COMPANY VERIFICATION CONCURRENCY
-- ============================================================

CREATE UNIQUE INDEX uq_company_verification_open
ON company_verification_request (company_id)
WHERE status IN ('PENDING','UNDER_REVIEW');


-- ============================================================
-- P07. JOB VISIBILITY / REJECTION REASON
-- ============================================================

ALTER TABLE job
    ADD COLUMN visibility varchar(30) NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN status_reason text;

ALTER TABLE job
    ADD CONSTRAINT ck_job_visibility
        CHECK (visibility IN ('PUBLIC','AFFILIATE_ONLY','PRIVATE')),
    ADD CONSTRAINT ck_job_rejected_reason
        CHECK (status <> 'REJECTED' OR status_reason IS NOT NULL);

CREATE INDEX idx_job_visibility_status
ON job (visibility, status, posted_at DESC);

COMMENT ON COLUMN job.visibility IS
'D07-ready job visibility. Exact actor permissions remain a business-rule/authorization concern.';


-- ============================================================
-- P08. MATCH TIER CONFIGURATION
-- ============================================================

CREATE TABLE match_tier_config (
    tier_code             varchar(30) PRIMARY KEY,
    display_name          varchar(80) NOT NULL,
    min_score             numeric(5,2) NOT NULL
                          CHECK (min_score >= 0 AND min_score <= 100),
    max_score             numeric(5,2) NOT NULL
                          CHECK (max_score >= 0 AND max_score <= 100),
    color_code            varchar(30) NOT NULL
                          CHECK (color_code IN ('RED','TEAL','LIGHT_GREEN','GRAY')),
    display_order         integer NOT NULL,
    is_active             boolean NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),

    CHECK (max_score >= min_score),

    CONSTRAINT ex_match_tier_no_overlap
        EXCLUDE USING gist (
            numrange(min_score, max_score, '[]') WITH &&
        )
        WHERE (is_active)
);

CREATE TRIGGER trg_match_tier_config_updated_at
BEFORE UPDATE ON match_tier_config
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Four semantic tiers preserve the four proposal ranges while FE can render colors.
INSERT INTO match_tier_config(
    tier_code, display_name, min_score, max_score, color_code, display_order
)
VALUES
    ('HIGH',        'High Match',        80.00, 100.00, 'RED',         1),
    ('MEDIUM_HIGH', 'Medium High Match', 70.00,  79.99, 'TEAL',        2),
    ('MEDIUM',      'Medium Match',      60.00,  69.99, 'LIGHT_GREEN', 3),
    ('LOW',         'Low Match',          0.00,  59.99, 'GRAY',        4)
ON CONFLICT (tier_code) DO NOTHING;

-- If existing rows already contain other values, normalize them before VALIDATE.
ALTER TABLE candidate_job_match
    ADD CONSTRAINT fk_candidate_job_match_tier
    FOREIGN KEY (match_tier) REFERENCES match_tier_config(tier_code)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE ai_match_result
    ADD CONSTRAINT fk_ai_match_result_tier
    FOREIGN KEY (match_tier) REFERENCES match_tier_config(tier_code)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE candidate_job_match
    VALIDATE CONSTRAINT fk_candidate_job_match_tier;

ALTER TABLE ai_match_result
    VALIDATE CONSTRAINT fk_ai_match_result_tier;

COMMENT ON TABLE candidate_job_match IS
'OPTIONAL D16. Pre-application AI job-fit result; not a committed baseline feature until D16 is approved.';

COMMENT ON COLUMN ai_match_result.match_tier IS
'Semantic tier (for example HIGH/MEDIUM_HIGH/MEDIUM/LOW). UI color comes from match_tier_config; AI does not make the final hiring decision.';


-- ============================================================
-- P08B. NOTIFICATION EVENT TYPES
-- ============================================================

ALTER TABLE notification
    DROP CONSTRAINT IF EXISTS notification_notification_type_check;

ALTER TABLE notification
    ADD CONSTRAINT ck_notification_type
    CHECK (notification_type IN (
        'ACCOUNT',
        'COMPANY',
        'JOB',
        'SUBMISSION',
        'JOB_FIT',
        'APPLICATION_STATUS',
        'INTERVIEW',
        'OFFER',
        'AFFILIATE',
        'COMMISSION',
        'PAYOUT',
        'SYSTEM'
    ));

COMMENT ON COLUMN notification.notification_type IS
'JOB_FIT is optional D16; other values cover baseline account/company/job/submission/recruitment/commission events.';


-- ============================================================
-- P09. SUBMISSION / APPLICATION CONCURRENCY + CROSS-TABLE INTEGRITY
-- ============================================================

ALTER TABLE submission
    ADD CONSTRAINT uq_submission_identity
        UNIQUE (submission_id, candidate_id, job_id);

ALTER TABLE submission
    DROP CONSTRAINT IF EXISTS submission_cv_id_fkey;

ALTER TABLE submission
    ADD CONSTRAINT fk_submission_cv_owner
        FOREIGN KEY (candidate_id, cv_id)
        REFERENCES candidate_cv(candidate_id, cv_id)
        ON DELETE RESTRICT;

-- Hard DB guard: same Candidate + Job cannot have two ACCEPTED submissions.
CREATE UNIQUE INDEX uq_submission_one_accepted
ON submission (job_id, candidate_id)
WHERE status = 'ACCEPTED';

ALTER TABLE application
    ADD COLUMN status_reason text;

ALTER TABLE application
    ADD CONSTRAINT ck_application_rejected_reason
        CHECK (status <> 'REJECTED' OR status_reason IS NOT NULL);

ALTER TABLE application
    DROP CONSTRAINT IF EXISTS application_accepted_submission_id_fkey;

ALTER TABLE application
    ADD CONSTRAINT fk_application_accepted_submission
        FOREIGN KEY (accepted_submission_id, candidate_id, job_id)
        REFERENCES submission(submission_id, candidate_id, job_id)
        ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION validate_application_accepted_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_status varchar(40);
BEGIN
    IF NEW.accepted_submission_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status
      INTO v_status
      FROM submission
     WHERE submission_id = NEW.accepted_submission_id
       AND candidate_id = NEW.candidate_id
       AND job_id = NEW.job_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION
            'accepted_submission_id does not belong to the same Candidate/Job';
    END IF;

    IF v_status <> 'ACCEPTED' THEN
        RAISE EXCEPTION
            'accepted_submission_id must reference an ACCEPTED submission';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_application_accepted_submission ON application;

CREATE TRIGGER trg_validate_application_accepted_submission
BEFORE INSERT OR UPDATE OF accepted_submission_id, candidate_id, job_id
ON application
FOR EACH ROW
EXECUTE FUNCTION validate_application_accepted_submission();


-- ============================================================
-- P10. OFFER / PLACEMENT CROSS-TABLE INTEGRITY
-- ============================================================

ALTER TABLE offer
    ADD CONSTRAINT uq_offer_application_pair
        UNIQUE (offer_id, application_id);

ALTER TABLE placement
    DROP CONSTRAINT IF EXISTS placement_offer_id_fkey;

ALTER TABLE placement
    ADD CONSTRAINT fk_placement_offer_application
        FOREIGN KEY (offer_id, application_id)
        REFERENCES offer(offer_id, application_id)
        ON DELETE RESTRICT;


-- ============================================================
-- P11. WARRANTY TERMINOLOGY
-- ============================================================

ALTER TABLE warranty
    ALTER COLUMN status SET DEFAULT 'IN_PROGRESS';

-- v3 used ACTIVE; v4 terminology uses IN_PROGRESS.
UPDATE warranty
SET status = 'IN_PROGRESS'
WHERE status = 'ACTIVE';

ALTER TABLE warranty
    DROP CONSTRAINT IF EXISTS warranty_status_check;

ALTER TABLE warranty
    ADD CONSTRAINT ck_warranty_status
        CHECK (status IN ('IN_PROGRESS','PASSED','BREACHED','CANCELLED'));

COMMENT ON TABLE warranty IS
'Warranty exists only when applicable. No row may represent NOT_APPLICABLE; absence of a warranty row means not applicable.';


-- ============================================================
-- P12. STRONG AFFILIATE ATTRIBUTION VALIDATION
-- ============================================================

DROP TRIGGER IF EXISTS trg_prevent_self_affiliate_attribution ON attribution;
DROP TRIGGER IF EXISTS trg_validate_affiliate_attribution ON attribution;
DROP FUNCTION IF EXISTS prevent_self_affiliate_attribution();

CREATE OR REPLACE FUNCTION validate_affiliate_attribution()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_affiliate_user_id      uuid;
    v_candidate_user_id      uuid;
    v_affiliate_email        varchar(255);
    v_affiliate_phone        varchar(30);
    v_candidate_email        varchar(255);
    v_candidate_phone        varchar(30);

    v_submission_user_id     uuid;
    v_submission_source      varchar(30);
    v_submission_status      varchar(40);
    v_submission_candidate   uuid;
    v_submission_job         uuid;

    v_application_candidate  uuid;
    v_application_job        uuid;
    v_accepted_submission    uuid;
BEGIN
    SELECT ap.user_id, lower(au.email), au.normalized_phone
      INTO v_affiliate_user_id, v_affiliate_email, v_affiliate_phone
      FROM affiliate_profile ap
      JOIN app_user au ON au.user_id = ap.user_id
     WHERE ap.affiliate_id = NEW.affiliate_id;

    IF v_affiliate_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid attribution: Affiliate profile not found';
    END IF;

    SELECT a.candidate_id, a.job_id, a.accepted_submission_id,
           c.user_id, lower(c.normalized_email), c.normalized_phone
      INTO v_application_candidate, v_application_job, v_accepted_submission,
           v_candidate_user_id, v_candidate_email, v_candidate_phone
      FROM application a
      JOIN candidate c ON c.candidate_id = a.candidate_id
     WHERE a.application_id = NEW.application_id;

    IF v_application_candidate IS NULL THEN
        RAISE EXCEPTION 'Invalid attribution: Application not found';
    END IF;

    SELECT submitted_by, source, status, candidate_id, job_id
      INTO v_submission_user_id, v_submission_source, v_submission_status,
           v_submission_candidate, v_submission_job
      FROM submission
     WHERE submission_id = NEW.winning_submission_id;

    IF v_submission_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid attribution: winning Submission not found';
    END IF;

    IF v_submission_source <> 'AFFILIATE' THEN
        RAISE EXCEPTION
            'Invalid attribution: winning Submission source must be AFFILIATE';
    END IF;

    IF v_submission_status <> 'ACCEPTED' THEN
        RAISE EXCEPTION
            'Invalid attribution: winning Submission must be ACCEPTED';
    END IF;

    IF v_submission_user_id IS DISTINCT FROM v_affiliate_user_id THEN
        RAISE EXCEPTION
            'Invalid attribution: winning Submission was not submitted by this Affiliate';
    END IF;

    IF v_submission_candidate IS DISTINCT FROM v_application_candidate
       OR v_submission_job IS DISTINCT FROM v_application_job THEN
        RAISE EXCEPTION
            'Invalid attribution: winning Submission Candidate/Job does not match Application';
    END IF;

    IF v_accepted_submission IS DISTINCT FROM NEW.winning_submission_id THEN
        RAISE EXCEPTION
            'Invalid attribution: winning Submission must equal Application.accepted_submission_id';
    END IF;

    IF v_candidate_user_id IS NOT NULL
       AND v_candidate_user_id = v_affiliate_user_id THEN
        RAISE EXCEPTION 'Self-attribution is not allowed: same app_user';
    END IF;

    IF v_candidate_email IS NOT NULL
       AND v_affiliate_email IS NOT NULL
       AND v_candidate_email = v_affiliate_email THEN
        RAISE EXCEPTION 'Self-attribution is not allowed: exact email match';
    END IF;

    IF v_candidate_phone IS NOT NULL
       AND v_affiliate_phone IS NOT NULL
       AND v_candidate_phone = v_affiliate_phone THEN
        RAISE EXCEPTION 'Self-attribution is not allowed: exact phone match';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_affiliate_attribution
BEFORE INSERT OR UPDATE OF application_id, affiliate_id, winning_submission_id
ON attribution
FOR EACH ROW
EXECUTE FUNCTION validate_affiliate_attribution();

COMMENT ON TABLE attribution IS
'First accepted Affiliate Submission attribution. Trigger validates source/status/Candidate/Job and blocks self-attribution by account/email/phone.';


-- ============================================================
-- P13. COMMISSION MILESTONE + RULE SNAPSHOT + ADJUSTMENT
-- ============================================================

CREATE TABLE commission_milestone (
    milestone_code       varchar(60) PRIMARY KEY,
    name                 varchar(150) NOT NULL,
    description          text,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_commission_milestone_updated_at
BEFORE UPDATE ON commission_milestone
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO commission_milestone(milestone_code, name, description)
VALUES
    ('CONTRACT_SIGNED', 'Contract Signed',
     'Proposal example milestone; applicability is controlled by Commission Rule'),
    ('PROBATION_PASSED', 'Probation Passed',
     'Proposal example milestone; applicability is controlled by Commission Rule')
ON CONFLICT (milestone_code) DO NOTHING;

ALTER TABLE commission_rule
    ADD CONSTRAINT fk_commission_rule_milestone
    FOREIGN KEY (milestone_type)
    REFERENCES commission_milestone(milestone_code)
    ON DELETE RESTRICT
    NOT VALID;

CREATE INDEX idx_commission_rule_active
ON commission_rule (service_type_id, milestone_type, effective_from DESC)
WHERE is_active = true;

ALTER TABLE commission
    ADD COLUMN rule_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN calculated_at timestamptz;

-- Existing v3 has PAID in Commission, but v4 uses payout.COMPLETED as payment source of truth.
-- Stop migration if live data still has PAID so the team can reconcile it explicitly.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM commission WHERE status = 'PAID') THEN
        RAISE EXCEPTION
            'Migration blocked: reconcile existing Commission status=PAID with Payout records before v4';
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM commission WHERE commission_rule_id IS NULL) THEN
        RAISE EXCEPTION
            'Migration blocked: every Commission must reference a Commission Rule in v4';
    END IF;
END;
$$;

ALTER TABLE commission
    ALTER COLUMN commission_rule_id SET NOT NULL;

ALTER TABLE commission
    DROP CONSTRAINT IF EXISTS commission_status_check;

ALTER TABLE commission
    ADD CONSTRAINT ck_commission_status
    CHECK (status IN (
        'PENDING','ELIGIBLE','NOT_ELIGIBLE','ON_HOLD',
        'APPROVED','ADJUSTED','REJECTED','PAYABLE','CANCELLED'
    ));

ALTER TABLE commission
    ADD CONSTRAINT ck_commission_approval_fields
        CHECK (
            status NOT IN ('APPROVED','PAYABLE')
            OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
        ),
    ADD CONSTRAINT ck_commission_payable_amount
        CHECK (status <> 'PAYABLE' OR amount > 0),
    ADD CONSTRAINT uq_commission_attribution_placement
        UNIQUE (attribution_id, placement_id);

ALTER TABLE commission
    ADD CONSTRAINT fk_commission_milestone
        FOREIGN KEY (milestone_type)
        REFERENCES commission_milestone(milestone_code)
        ON DELETE RESTRICT
        NOT VALID;

ALTER TABLE commission_rule
    VALIDATE CONSTRAINT fk_commission_rule_milestone;

ALTER TABLE commission
    VALIDATE CONSTRAINT fk_commission_milestone;

CREATE INDEX idx_commission_status
ON commission (status, created_at DESC);

CREATE OR REPLACE FUNCTION populate_commission_rule_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_snapshot jsonb;
    v_refresh boolean := false;
BEGIN
    IF NEW.commission_rule_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_refresh := true;
    ELSE
        v_refresh :=
            NEW.commission_rule_id IS DISTINCT FROM OLD.commission_rule_id
            OR NEW.rule_snapshot = '{}'::jsonb;
    END IF;

    IF v_refresh THEN
        SELECT jsonb_build_object(
            'commission_rule_id', cr.commission_rule_id,
            'service_type_id', cr.service_type_id,
            'name', cr.name,
            'milestone_type', cr.milestone_type,
            'rate_type', cr.rate_type,
            'rate_value', cr.rate_value,
            'warranty_required', cr.warranty_required,
            'effective_from', cr.effective_from,
            'effective_to', cr.effective_to
        )
          INTO v_snapshot
          FROM commission_rule cr
         WHERE cr.commission_rule_id = NEW.commission_rule_id;

        IF v_snapshot IS NULL THEN
            RAISE EXCEPTION 'Commission Rule not found';
        END IF;

        NEW.rule_snapshot := v_snapshot;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_commission_rule_snapshot ON commission;

CREATE TRIGGER trg_populate_commission_rule_snapshot
BEFORE INSERT OR UPDATE OF commission_rule_id
ON commission
FOR EACH ROW
EXECUTE FUNCTION populate_commission_rule_snapshot();

-- Backfill snapshot for pre-existing commissions.
UPDATE commission
SET commission_rule_id = commission_rule_id
WHERE commission_rule_id IS NOT NULL
  AND rule_snapshot = '{}'::jsonb;


CREATE OR REPLACE FUNCTION validate_commission_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_attr_application   uuid;
    v_place_application  uuid;
    v_job_service_type   uuid;
    v_rule_service_type  uuid;
    v_rule_milestone     varchar(60);
BEGIN
    SELECT application_id
      INTO v_attr_application
      FROM attribution
     WHERE attribution_id = NEW.attribution_id;

    SELECT p.application_id, j.service_type_id
      INTO v_place_application, v_job_service_type
      FROM placement p
      JOIN application a ON a.application_id = p.application_id
      JOIN job j ON j.job_id = a.job_id
     WHERE p.placement_id = NEW.placement_id;

    IF v_attr_application IS NULL OR v_place_application IS NULL THEN
        RAISE EXCEPTION 'Invalid Commission context: Attribution/Placement not found';
    END IF;

    IF v_attr_application IS DISTINCT FROM v_place_application THEN
        RAISE EXCEPTION
            'Invalid Commission context: Attribution and Placement must belong to the same Application';
    END IF;

    SELECT service_type_id, milestone_type
      INTO v_rule_service_type, v_rule_milestone
      FROM commission_rule
     WHERE commission_rule_id = NEW.commission_rule_id;

    IF v_rule_service_type IS NULL THEN
        RAISE EXCEPTION 'Invalid Commission context: Commission Rule not found';
    END IF;

    IF v_rule_service_type IS DISTINCT FROM v_job_service_type THEN
        RAISE EXCEPTION
            'Invalid Commission context: Commission Rule Service Type does not match Job Service Type';
    END IF;

    IF NEW.milestone_type IS NULL THEN
        NEW.milestone_type := v_rule_milestone;
    ELSIF v_rule_milestone IS NOT NULL
          AND NEW.milestone_type IS DISTINCT FROM v_rule_milestone THEN
        RAISE EXCEPTION
            'Invalid Commission context: milestone_type does not match Commission Rule';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_commission_context ON commission;

CREATE TRIGGER trg_validate_commission_context
BEFORE INSERT OR UPDATE OF attribution_id, placement_id, commission_rule_id, milestone_type
ON commission
FOR EACH ROW
EXECUTE FUNCTION validate_commission_context();


CREATE TABLE commission_adjustment (
    commission_adjustment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id            uuid NOT NULL,
    old_amount               numeric(18,2) NOT NULL CHECK (old_amount >= 0),
    new_amount               numeric(18,2) NOT NULL CHECK (new_amount >= 0),
    reason                   text NOT NULL,
    adjusted_by              uuid NOT NULL,
    adjusted_at              timestamptz NOT NULL DEFAULT now(),

    CHECK (old_amount <> new_amount),

    FOREIGN KEY (commission_id)
        REFERENCES commission(commission_id) ON DELETE RESTRICT,
    FOREIGN KEY (adjusted_by)
        REFERENCES app_user(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_commission_adjustment_commission
ON commission_adjustment (commission_id, adjusted_at DESC);


CREATE OR REPLACE FUNCTION apply_commission_adjustment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_amount   numeric(18,2);
    v_completed_total numeric(18,2);
BEGIN
    SELECT amount
      INTO v_current_amount
      FROM commission
     WHERE commission_id = NEW.commission_id
     FOR UPDATE;

    IF v_current_amount IS NULL THEN
        RAISE EXCEPTION 'Commission not found';
    END IF;

    IF v_current_amount IS DISTINCT FROM NEW.old_amount THEN
        RAISE EXCEPTION
            'Stale Commission adjustment: old_amount does not match current Commission amount';
    END IF;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_completed_total
      FROM payout
     WHERE commission_id = NEW.commission_id
       AND status = 'COMPLETED';

    IF NEW.new_amount < v_completed_total THEN
        RAISE EXCEPTION
            'Adjusted Commission amount cannot be lower than completed Payout total';
    END IF;

    UPDATE commission
       SET amount = NEW.new_amount,
           status = 'ADJUSTED'
     WHERE commission_id = NEW.commission_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_commission_adjustment
BEFORE INSERT ON commission_adjustment
FOR EACH ROW
EXECUTE FUNCTION apply_commission_adjustment();


DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM commission
        WHERE adjustment_reason IS NOT NULL
          AND btrim(adjustment_reason) <> ''
    ) THEN
        RAISE EXCEPTION
            'Migration blocked: move existing commission.adjustment_reason data into commission_adjustment before dropping the old column';
    END IF;
END;
$$;

ALTER TABLE commission
    DROP COLUMN adjustment_reason;

COMMENT ON TABLE commission IS
'Commission eligibility/calculation domain. PAYABLE means approved for payment; payment completion is represented by payout.status=COMPLETED.';

COMMENT ON TABLE commission_adjustment IS
'Immutable adjustment event with old/new amount and reason. Application should update commission.amount in the same transaction after approved adjustment.';


-- ============================================================
-- P14. PAYOUT AS PAYMENT SOURCE OF TRUTH
-- ============================================================

ALTER TABLE payout
    ADD COLUMN attempt_no integer;

WITH ranked AS (
    SELECT payout_id,
           row_number() OVER (
               PARTITION BY commission_id
               ORDER BY created_at, payout_id
           )::integer AS rn
    FROM payout
)
UPDATE payout p
SET attempt_no = ranked.rn
FROM ranked
WHERE ranked.payout_id = p.payout_id;

ALTER TABLE payout
    ALTER COLUMN attempt_no SET DEFAULT 1,
    ALTER COLUMN attempt_no SET NOT NULL;

ALTER TABLE payout
    ADD CONSTRAINT ck_payout_attempt_no CHECK (attempt_no > 0),
    ADD CONSTRAINT uq_payout_attempt UNIQUE (commission_id, attempt_no);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM payout WHERE status = 'PROCESSING') THEN
        RAISE EXCEPTION
            'Migration blocked: resolve existing Payout status=PROCESSING before v4';
    END IF;

    IF EXISTS (SELECT 1 FROM payout WHERE recorded_by IS NULL) THEN
        RAISE EXCEPTION
            'Migration blocked: recorded_by must be populated for existing Payout rows before v4';
    END IF;
END;
$$;

ALTER TABLE payout
    DROP CONSTRAINT IF EXISTS payout_status_check;

ALTER TABLE payout
    ADD CONSTRAINT ck_payout_status
        CHECK (status IN ('PENDING','COMPLETED','FAILED','CANCELLED')),
    ADD CONSTRAINT ck_payout_completed_date
        CHECK (status <> 'COMPLETED' OR payout_date IS NOT NULL);

ALTER TABLE payout
    ALTER COLUMN recorded_by SET NOT NULL;

CREATE INDEX idx_payout_commission_status
ON payout (commission_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_payout_overpayment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_commission_amount numeric(18,2);
    v_commission_status varchar(30);
    v_completed_total   numeric(18,2);
BEGIN
    SELECT amount, status
      INTO v_commission_amount, v_commission_status
      FROM commission
     WHERE commission_id = NEW.commission_id
     FOR UPDATE;

    IF v_commission_amount IS NULL THEN
        RAISE EXCEPTION 'Commission not found';
    END IF;

    IF NEW.status = 'COMPLETED' THEN
        IF v_commission_status <> 'PAYABLE' THEN
            RAISE EXCEPTION
                'Completed Payout requires Commission status PAYABLE';
        END IF;

        SELECT COALESCE(SUM(amount), 0)
          INTO v_completed_total
          FROM payout
         WHERE commission_id = NEW.commission_id
           AND status = 'COMPLETED'
           AND payout_id <> NEW.payout_id;

        IF v_completed_total + NEW.amount > v_commission_amount THEN
            RAISE EXCEPTION
                'Completed Payout total exceeds Commission amount';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payout_overpayment ON payout;

CREATE TRIGGER trg_prevent_payout_overpayment
BEFORE INSERT OR UPDATE OF amount, status, commission_id
ON payout
FOR EACH ROW
EXECUTE FUNCTION prevent_payout_overpayment();


CREATE OR REPLACE FUNCTION prevent_commission_below_paid_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_completed_total numeric(18,2);
BEGIN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
        SELECT COALESCE(SUM(amount), 0)
          INTO v_completed_total
          FROM payout
         WHERE commission_id = OLD.commission_id
           AND status = 'COMPLETED';

        IF NEW.amount < v_completed_total THEN
            RAISE EXCEPTION
                'Commission amount cannot be lower than completed Payout total';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_commission_below_paid_total ON commission;

CREATE TRIGGER trg_prevent_commission_below_paid_total
BEFORE UPDATE OF amount
ON commission
FOR EACH ROW
EXECUTE FUNCTION prevent_commission_below_paid_total();

COMMENT ON TABLE payout IS
'Manual/external payout ledger. HR Connect records payment evidence/status; no payment gateway is implied.';


-- ============================================================
-- P15. APPEND-ONLY AUDIT + AUTOMATIC STATUS HISTORY
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_actor
ON audit_log (actor_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;

CREATE TRIGGER trg_audit_log_no_update
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();


CREATE INDEX IF NOT EXISTS idx_application_status_history_app
ON application_status_history (application_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_status_history_job
ON job_status_history (job_id, changed_at DESC);


CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_status varchar(40);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old_status := NULL;
    ELSE
        IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
            RETURN NEW;
        END IF;
        v_old_status := OLD.status;
    END IF;

    INSERT INTO application_status_history(
        application_id, old_status, new_status, changed_by, reason, changed_at
    )
    VALUES (
        NEW.application_id,
        v_old_status,
        NEW.status,
        current_actor_user_id(),
        NEW.status_reason,
        now()
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_application_status ON application;

CREATE TRIGGER trg_log_application_status
AFTER INSERT OR UPDATE OF status
ON application
FOR EACH ROW
EXECUTE FUNCTION log_application_status_change();


CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_status varchar(30);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old_status := NULL;
    ELSE
        IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
            RETURN NEW;
        END IF;
        v_old_status := OLD.status;
    END IF;

    INSERT INTO job_status_history(
        job_id, old_status, new_status, changed_by, reason, changed_at
    )
    VALUES (
        NEW.job_id,
        v_old_status,
        NEW.status,
        current_actor_user_id(),
        NEW.status_reason,
        now()
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_job_status ON job;

CREATE TRIGGER trg_log_job_status
AFTER INSERT OR UPDATE OF status
ON job
FOR EACH ROW
EXECUTE FUNCTION log_job_status_change();


CREATE OR REPLACE FUNCTION audit_business_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_old jsonb;
    v_new jsonb;
    v_id  uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old := NULL;
        v_new := to_jsonb(NEW);
        v_id := (v_new ->> TG_ARGV[1])::uuid;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_id := (v_new ->> TG_ARGV[1])::uuid;
    ELSE
        v_old := to_jsonb(OLD);
        v_new := NULL;
        v_id := (v_old ->> TG_ARGV[1])::uuid;
    END IF;

    INSERT INTO audit_log(
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_at
    )
    VALUES (
        current_actor_user_id(),
        TG_OP,
        TG_ARGV[0],
        v_id,
        v_old,
        v_new,
        now()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_attribution ON attribution;
DROP TRIGGER IF EXISTS trg_audit_commission ON commission;
DROP TRIGGER IF EXISTS trg_audit_payout ON payout;
DROP TRIGGER IF EXISTS trg_audit_commission_adjustment ON commission_adjustment;

CREATE TRIGGER trg_audit_attribution
AFTER INSERT OR UPDATE OR DELETE ON attribution
FOR EACH ROW
EXECUTE FUNCTION audit_business_row_change('ATTRIBUTION', 'attribution_id');

CREATE TRIGGER trg_audit_commission
AFTER INSERT OR UPDATE OR DELETE ON commission
FOR EACH ROW
EXECUTE FUNCTION audit_business_row_change('COMMISSION', 'commission_id');

CREATE TRIGGER trg_audit_payout
AFTER INSERT OR UPDATE OR DELETE ON payout
FOR EACH ROW
EXECUTE FUNCTION audit_business_row_change('PAYOUT', 'payout_id');

CREATE TRIGGER trg_audit_commission_adjustment
AFTER INSERT OR UPDATE OR DELETE ON commission_adjustment
FOR EACH ROW
EXECUTE FUNCTION audit_business_row_change(
    'COMMISSION_ADJUSTMENT',
    'commission_adjustment_id'
);

COMMENT ON TABLE audit_log IS
'Append-only audit trail. Set hr_connect.current_user_id in the application transaction when actor identity is available.';


-- ============================================================
-- P16. FINAL COMMENTS / SCOPE BOUNDARIES
-- ============================================================

COMMENT ON TABLE app_user IS
'One login identity. A user may simultaneously hold multiple roles through user_role. Candidate + Affiliate is supported on the same account.';

COMMENT ON TABLE affiliate_application IS
'Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE_RECRUITER role in the same transaction.';

COMMENT ON TABLE ai_match_result IS
'Post-application AI screening support. Match Score/Tier/Highlight support human review; AI does not auto-reject/shortlist/hire.';

COMMENT ON TABLE candidate_job_match IS
'OPTIONAL D16 capability. Keep disabled/out of baseline if pre-application job-fit recommendation is not approved.';

-- Intentionally NOT added:
-- - Revenue/Billing/Invoice entities: D13 is not baseline-confirmed.
-- - Hard-coded Affiliate rating formula: D17 remains pending.
-- - Payment gateway transaction model: payout is manual/external in current scope.
-- - Hard-coded final approver permissions: D02 remains pending.

-- ============================================================
-- END v4 HARDENING PATCH
-- ============================================================


-- ============================================================
-- v5 HARDENING
-- ============================================================

SET search_path TO hr_connect, public;

-- ============================================================
-- H01. COMMISSION ADJUSTMENT MUST BE APPEND-ONLY
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_commission_adjustment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'commission_adjustment is immutable; create a new adjustment event instead of %',
        TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_adjustment_immutable
ON commission_adjustment;

CREATE TRIGGER trg_commission_adjustment_immutable
BEFORE UPDATE OR DELETE ON commission_adjustment
FOR EACH ROW
EXECUTE FUNCTION prevent_commission_adjustment_mutation();

COMMENT ON TABLE commission_adjustment IS
'Append-only Commission adjustment event. UPDATE/DELETE are prohibited; corrections require a new adjustment event.';


-- ============================================================
-- H02. PAYOUT LEDGER LIFECYCLE / IMMUTABILITY
-- ============================================================
-- Payout is a financial/audit ledger. Physical DELETE is not allowed.
-- PENDING may transition to COMPLETED / FAILED / CANCELLED.
-- COMPLETED / FAILED / CANCELLED are terminal and cannot be edited.
-- A retry must be represented by a new payout attempt_no row.

CREATE OR REPLACE FUNCTION guard_payout_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Payout rows cannot be deleted; use status=CANCELLED when a pending payout must be voided';
    END IF;

    IF OLD.status IN ('COMPLETED','FAILED','CANCELLED') THEN
        RAISE EXCEPTION
            'Payout in terminal status % is immutable; create a new payout attempt when required',
            OLD.status;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status <> 'PENDING'
           OR NEW.status NOT IN ('COMPLETED','FAILED','CANCELLED') THEN
            RAISE EXCEPTION
                'Invalid Payout status transition: % -> %',
                OLD.status, NEW.status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payout_lifecycle ON payout;

CREATE TRIGGER trg_guard_payout_lifecycle
BEFORE UPDATE OR DELETE ON payout
FOR EACH ROW
EXECUTE FUNCTION guard_payout_lifecycle();

COMMENT ON TABLE payout IS
'Manual/external payout ledger. Rows are never physically deleted. PENDING may become COMPLETED/FAILED/CANCELLED; terminal rows are immutable.';


-- ============================================================
-- H03. REFERENCED ACCEPTED SUBMISSION CANNOT BE INVALIDATED
-- ============================================================
-- Once a Submission is used as Application.accepted_submission_id or
-- Attribution.winning_submission_id, its accepted identity/source snapshot
-- must remain stable for auditability and attribution correctness.

CREATE OR REPLACE FUNCTION guard_referenced_submission_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_referenced boolean;
BEGIN
    SELECT
        EXISTS (
            SELECT 1
              FROM application a
             WHERE a.accepted_submission_id = OLD.submission_id
        )
        OR
        EXISTS (
            SELECT 1
              FROM attribution atb
             WHERE atb.winning_submission_id = OLD.submission_id
        )
      INTO v_is_referenced;

    IF NOT v_is_referenced THEN
        RETURN NEW;
    END IF;

    IF NEW.status <> 'ACCEPTED' THEN
        RAISE EXCEPTION
            'Referenced accepted Submission % cannot leave ACCEPTED status',
            OLD.submission_id;
    END IF;

    IF NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
       OR NEW.cv_id IS DISTINCT FROM OLD.cv_id
       OR NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION
            'Referenced accepted Submission % has immutable Candidate/CV/Job/source/submitter/timestamp fields',
            OLD.submission_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_referenced_submission_mutation
ON submission;

CREATE TRIGGER trg_guard_referenced_submission_mutation
BEFORE UPDATE OF status, candidate_id, cv_id, job_id, submitted_by, source, submitted_at
ON submission
FOR EACH ROW
EXECUTE FUNCTION guard_referenced_submission_mutation();

COMMENT ON TABLE submission IS
'Submission intake/audit record. A Submission referenced by Application/Attribution as the accepted winner cannot be invalidated or have its accepted identity/source snapshot changed.';


-- ============================================================
-- H04. CANDIDATE MERGE TARGET / CYCLE SAFETY
-- ============================================================
-- Rules:
--   * status=MERGED requires merged_into_candidate_id.
--   * merge target must exist and currently be ACTIVE.
--   * merge cannot create a chain/cycle back to the source Candidate.
--   * a Candidate serving as a merge target must remain ACTIVE.

CREATE OR REPLACE FUNCTION validate_candidate_merge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_status varchar(30);
    v_cycle_found   boolean := false;
BEGIN
    IF NEW.status = 'MERGED' THEN
        IF NEW.merged_into_candidate_id IS NULL THEN
            RAISE EXCEPTION
                'MERGED Candidate must specify merged_into_candidate_id';
        END IF;

        IF NEW.merged_into_candidate_id = NEW.candidate_id THEN
            RAISE EXCEPTION
                'Candidate cannot be merged into itself';
        END IF;

        -- Lock the canonical target so concurrent cross-merges cannot both succeed.
        SELECT c.status
          INTO v_target_status
          FROM candidate c
         WHERE c.candidate_id = NEW.merged_into_candidate_id
         FOR UPDATE;

        IF v_target_status IS NULL THEN
            RAISE EXCEPTION
                'Candidate merge target % does not exist',
                NEW.merged_into_candidate_id;
        END IF;

        IF v_target_status <> 'ACTIVE' THEN
            RAISE EXCEPTION
                'Candidate merge target % must be ACTIVE, current status=%',
                NEW.merged_into_candidate_id, v_target_status;
        END IF;

        WITH RECURSIVE merge_chain AS (
            SELECT c.candidate_id, c.merged_into_candidate_id
              FROM candidate c
             WHERE c.candidate_id = NEW.merged_into_candidate_id

            UNION ALL

            SELECT c2.candidate_id, c2.merged_into_candidate_id
              FROM candidate c2
              JOIN merge_chain mc
                ON c2.candidate_id = mc.merged_into_candidate_id
             WHERE mc.merged_into_candidate_id IS NOT NULL
        )
        SELECT EXISTS (
            SELECT 1
              FROM merge_chain
             WHERE candidate_id = NEW.candidate_id
        )
          INTO v_cycle_found;

        IF v_cycle_found THEN
            RAISE EXCEPTION
                'Candidate merge would create a cycle involving Candidate %',
                NEW.candidate_id;
        END IF;
    END IF;

    -- A canonical Candidate already referenced as a merge target must stay ACTIVE.
    IF NEW.status <> 'ACTIVE'
       AND EXISTS (
            SELECT 1
              FROM candidate src
             WHERE src.merged_into_candidate_id = NEW.candidate_id
               AND src.candidate_id <> NEW.candidate_id
       ) THEN
        RAISE EXCEPTION
            'Candidate % is a canonical merge target and must remain ACTIVE',
            NEW.candidate_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_candidate_merge ON candidate;

CREATE TRIGGER trg_validate_candidate_merge
BEFORE INSERT OR UPDATE OF status, merged_into_candidate_id
ON candidate
FOR EACH ROW
EXECUTE FUNCTION validate_candidate_merge();

COMMENT ON COLUMN candidate.merged_into_candidate_id IS
'Canonical ACTIVE Candidate that owns the merged identity. Merge cycles and non-ACTIVE targets are rejected.';


-- ============================================================
-- H05. NOTIFICATION READ-STATE CONSISTENCY
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM notification
         WHERE (is_read = true  AND read_at IS NULL)
            OR (is_read = false AND read_at IS NOT NULL)
    ) THEN
        RAISE EXCEPTION
            'Migration blocked: normalize notification.is_read/read_at before applying v5';
    END IF;
END;
$$;

ALTER TABLE notification
    DROP CONSTRAINT IF EXISTS ck_notification_read_state;

ALTER TABLE notification
    ADD CONSTRAINT ck_notification_read_state
    CHECK (
        (is_read = false AND read_at IS NULL)
        OR
        (is_read = true AND read_at IS NOT NULL)
    );


-- ============================================================
-- H06. APP USER EMAIL TRIM + CASE INSENSITIVE UNIQUENESS
-- ============================================================
-- Backend should still normalize/trim before insert. This DB guard prevents
-- 'user@example.com' and '  user@example.com  ' from becoming two accounts.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM app_user
         WHERE email IS DISTINCT FROM btrim(email)
    ) THEN
        RAISE EXCEPTION
            'Migration blocked: trim existing app_user.email values before applying v5';
    END IF;
END;
$$;

DROP INDEX IF EXISTS uq_app_user_email_ci;

CREATE UNIQUE INDEX uq_app_user_email_ci
ON app_user (lower(btrim(email)));

ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS ck_app_user_email_trimmed;

ALTER TABLE app_user
    ADD CONSTRAINT ck_app_user_email_trimmed
    CHECK (email = btrim(email));


-- ============================================================
-- H07. DOCUMENTED STATE-MACHINE BOUNDARY
-- ============================================================
-- Job/Application/Commission transition graphs remain service-layer controlled
-- until the corresponding Business Rules / State Machines are formally baselined.
-- DB still enforces allowed status values, key invariants, audit/history, money
-- integrity, and accepted-submission/attribution immutability.

COMMENT ON COLUMN job.status IS
'Allowed Job states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.';

COMMENT ON COLUMN application.status IS
'Allowed Application states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.';

COMMENT ON COLUMN commission.status IS
'Allowed Commission states. PAYABLE means approved for external/manual payment. payout.status=COMPLETED is payment source of truth.';

COMMIT;
