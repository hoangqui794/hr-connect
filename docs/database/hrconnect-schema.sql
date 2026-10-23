CREATE TABLE IF NOT EXISTS public."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE public.audit_log_audit_log_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE NO CYCLE;

CREATE TABLE public.app_user (
    user_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    display_name character varying(255),
    phone character varying(30),
    normalized_phone character varying(30),
    avatar_url text,
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    email_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT app_user_pkey PRIMARY KEY (user_id)
);
COMMENT ON TABLE public.app_user IS 'One login identity. A user may simultaneously hold multiple roles through user_role. Candidate + Affiliate is supported on the same account.';

CREATE TABLE public.commission_milestone (
    milestone_code character varying(60) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT commission_milestone_pkey PRIMARY KEY (milestone_code)
);

CREATE TABLE public.company (
    company_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    company_name character varying(255) NOT NULL,
    tax_code character varying(80),
    industry character varying(120),
    company_size character varying(50),
    website character varying(255),
    address text,
    description text,
    verification_status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    verified_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT company_pkey PRIMARY KEY (company_id)
);

CREATE TABLE public.cv_template (
    cv_template_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(80) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    preview_url text,
    template_config jsonb NOT NULL DEFAULT ('{}'::jsonb),
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT cv_template_pkey PRIMARY KEY (cv_template_id)
);

CREATE TABLE public.match_tier_config (
    tier_code character varying(30) NOT NULL,
    display_name character varying(80) NOT NULL,
    min_score numeric(5,2) NOT NULL,
    max_score numeric(5,2) NOT NULL,
    color_code character varying(30) NOT NULL,
    display_order integer NOT NULL,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT match_tier_config_pkey PRIMARY KEY (tier_code)
);

CREATE TABLE public.permission (
    permission_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(120) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(60) NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT permission_pkey PRIMARY KEY (permission_id)
);

CREATE TABLE public.role (
    role_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(60) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    is_system boolean NOT NULL DEFAULT TRUE,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT role_pkey PRIMARY KEY (role_id)
);

CREATE TABLE public.service_type (
    service_type_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(50) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT service_type_pkey PRIMARY KEY (service_type_id)
);

CREATE TABLE public.skill (
    skill_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    skill_name character varying(120) NOT NULL,
    normalized_name character varying(120) NOT NULL,
    category character varying(120),
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT skill_pkey PRIMARY KEY (skill_id)
);

CREATE TABLE public.admin_profile (
    admin_profile_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    employee_code character varying(50),
    job_title character varying(120),
    status character varying(30) NOT NULL DEFAULT ('ACTIVE'::character varying),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT admin_profile_pkey PRIMARY KEY (admin_profile_id),
    CONSTRAINT admin_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);

CREATE TABLE public.affiliate_application (
    affiliate_application_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    affiliate_type character varying(50) NOT NULL DEFAULT ('RECRUITER'::character varying),
    display_name character varying(180),
    tax_information character varying(255),
    contact_person character varying(180),
    phone character varying(30),
    address text,
    submitted_data jsonb NOT NULL DEFAULT ('{}'::jsonb),
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    reviewed_by uuid,
    review_note text,
    submitted_at timestamp with time zone NOT NULL DEFAULT (now()),
    reviewed_at timestamp with time zone,
    CONSTRAINT affiliate_application_pkey PRIMARY KEY (affiliate_application_id),
    CONSTRAINT affiliate_application_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT affiliate_application_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.affiliate_application IS 'Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE_RECRUITER role in the same transaction.';

CREATE TABLE public.affiliate_profile (
    affiliate_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    affiliate_type character varying(50) NOT NULL DEFAULT ('RECRUITER'::character varying),
    display_name character varying(180),
    tax_information character varying(255),
    contact_person character varying(180),
    phone character varying(30),
    address text,
    status character varying(30) NOT NULL DEFAULT ('ACTIVE'::character varying),
    verified_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT affiliate_profile_pkey PRIMARY KEY (affiliate_id),
    CONSTRAINT affiliate_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);

CREATE TABLE public.audit_log (
    audit_log_id bigint NOT NULL DEFAULT (nextval('audit_log_audit_log_id_seq'::regclass)),
    actor_user_id uuid,
    action character varying(120) NOT NULL,
    entity_type character varying(80),
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    correlation_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT audit_log_pkey PRIMARY KEY (audit_log_id),
    CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.audit_log IS 'Append-only audit trail. Set hr_connect.current_user_id in the application transaction when actor identity is available.';

CREATE TABLE public.candidate (
    candidate_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid,
    full_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(30),
    normalized_email character varying(255),
    normalized_phone character varying(30),
    date_of_birth date,
    gender character varying(30),
    current_address text,
    highest_education character varying(120),
    years_of_experience numeric(5,2),
    summary text,
    profile_visibility character varying(30) NOT NULL DEFAULT ('PRIVATE'::character varying),
    status character varying(30) NOT NULL DEFAULT ('ACTIVE'::character varying),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    merged_into_candidate_id uuid,
    CONSTRAINT candidate_pkey PRIMARY KEY (candidate_id),
    CONSTRAINT candidate_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_candidate_merged_into FOREIGN KEY (merged_into_candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT
);
COMMENT ON COLUMN public.candidate.merged_into_candidate_id IS 'Canonical ACTIVE Candidate that owns the merged identity. Merge cycles and non-ACTIVE targets are rejected.';

CREATE TABLE public.email_outbox (
    email_outbox_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid,
    recipient_email character varying(255) NOT NULL,
    template_code character varying(80) NOT NULL,
    subject character varying(255),
    payload jsonb NOT NULL DEFAULT ('{}'::jsonb),
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    retry_count integer NOT NULL DEFAULT 0,
    next_retry_at timestamp with time zone,
    sent_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT email_outbox_pkey PRIMARY KEY (email_outbox_id),
    CONSTRAINT email_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE TABLE public.internal_hr_profile (
    hr_profile_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    employee_code character varying(50),
    department character varying(120),
    job_title character varying(120),
    status character varying(30) NOT NULL DEFAULT ('ACTIVE'::character varying),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT internal_hr_profile_pkey PRIMARY KEY (hr_profile_id),
    CONSTRAINT internal_hr_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);

CREATE TABLE public.notification (
    notification_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    notification_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    related_entity_type character varying(60),
    related_entity_id uuid,
    metadata jsonb NOT NULL DEFAULT ('{}'::jsonb),
    is_read boolean NOT NULL DEFAULT FALSE,
    read_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT notification_pkey PRIMARY KEY (notification_id),
    CONSTRAINT notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE CASCADE
);
COMMENT ON TABLE public.notification IS 'In-app notification store. JOB_FIT notifications may reference a Job through related_entity_type/related_entity_id.';
COMMENT ON COLUMN public.notification.notification_type IS 'JOB_FIT is optional D16; other values cover baseline account/company/job/submission/recruitment/commission events.';

CREATE TABLE public.refresh_token (
    refresh_token_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by_token_id uuid,
    created_by_ip inet,
    revoked_by_ip inet,
    revoke_reason character varying(255),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT refresh_token_pkey PRIMARY KEY (refresh_token_id),
    CONSTRAINT refresh_token_replaced_by_token_id_fkey FOREIGN KEY (replaced_by_token_id) REFERENCES public.refresh_token (refresh_token_id) ON DELETE SET NULL,
    CONSTRAINT refresh_token_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE CASCADE
);

CREATE TABLE public.user_token (
    token_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    token_type character varying(40) NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempt_count integer NOT NULL DEFAULT 0,
    created_by_ip inet,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT user_token_pkey PRIMARY KEY (token_id),
    CONSTRAINT user_token_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE CASCADE
);

CREATE TABLE public.company_user (
    company_user_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    company_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_in_company character varying(120),
    is_primary_contact boolean NOT NULL DEFAULT FALSE,
    status character varying(30) NOT NULL DEFAULT ('ACTIVE'::character varying),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT company_user_pkey PRIMARY KEY (company_user_id),
    CONSTRAINT company_user_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company (company_id) ON DELETE RESTRICT,
    CONSTRAINT company_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);

CREATE TABLE public.company_verification_request (
    company_verification_request_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    company_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    reviewed_by uuid,
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    submitted_payload jsonb NOT NULL DEFAULT ('{}'::jsonb),
    review_note text,
    submitted_at timestamp with time zone NOT NULL DEFAULT (now()),
    reviewed_at timestamp with time zone,
    CONSTRAINT company_verification_request_pkey PRIMARY KEY (company_verification_request_id),
    CONSTRAINT company_verification_request_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company (company_id) ON DELETE RESTRICT,
    CONSTRAINT company_verification_request_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT company_verification_request_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);

CREATE TABLE public.role_permission (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    granted_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT role_permission_pkey PRIMARY KEY (role_id, permission_id),
    CONSTRAINT role_permission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permission (permission_id) ON DELETE RESTRICT,
    CONSTRAINT role_permission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role (role_id) ON DELETE CASCADE
);

CREATE TABLE public.user_role (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    assignment_source character varying(40) NOT NULL DEFAULT ('SYSTEM'::character varying),
    assigned_at timestamp with time zone NOT NULL DEFAULT (now()),
    status character varying(20) NOT NULL DEFAULT ('ACTIVE'::character varying),
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    CONSTRAINT user_role_pkey PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_role_revoked_by FOREIGN KEY (revoked_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT user_role_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role (role_id) ON DELETE RESTRICT,
    CONSTRAINT user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE CASCADE
);
COMMENT ON TABLE public.user_role IS 'Role ownership/lifecycle. Candidate and Affiliate may coexist on the same app_user. Other multi-role combinations remain subject to business policy.';

CREATE TABLE public.commission_rule (
    commission_rule_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    service_type_id uuid NOT NULL,
    name character varying(180) NOT NULL,
    milestone_type character varying(60),
    rate_type character varying(30),
    rate_value numeric(18,4),
    warranty_required boolean NOT NULL DEFAULT FALSE,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT commission_rule_pkey PRIMARY KEY (commission_rule_id),
    CONSTRAINT commission_rule_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES public.service_type (service_type_id) ON DELETE RESTRICT,
    CONSTRAINT fk_commission_rule_milestone FOREIGN KEY (milestone_type) REFERENCES public.commission_milestone (milestone_code) ON DELETE RESTRICT
);

CREATE TABLE public.job (
    job_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    company_id uuid NOT NULL,
    service_type_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    location character varying(255),
    employment_type character varying(50),
    salary_min numeric(18,2),
    salary_max numeric(18,2),
    currency_code character(3) NOT NULL DEFAULT ('VND'::bpchar),
    quantity integer NOT NULL DEFAULT 1,
    status character varying(30) NOT NULL DEFAULT ('DRAFT'::character varying),
    posted_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    visibility character varying(30) NOT NULL DEFAULT ('PUBLIC'::character varying),
    status_reason text,
    CONSTRAINT job_pkey PRIMARY KEY (job_id),
    CONSTRAINT job_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company (company_id) ON DELETE RESTRICT,
    CONSTRAINT job_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user (user_id) ON DELETE RESTRICT,
    CONSTRAINT job_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES public.service_type (service_type_id) ON DELETE RESTRICT
);
COMMENT ON COLUMN public.job.status IS 'Allowed Job states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.';
COMMENT ON COLUMN public.job.visibility IS 'D07-ready job visibility. Exact actor permissions remain a business-rule/authorization concern.';

CREATE TABLE public.affiliate_performance (
    affiliate_performance_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    affiliate_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_submissions integer NOT NULL DEFAULT 0,
    total_shortlisted integer NOT NULL DEFAULT 0,
    total_interviews integer NOT NULL DEFAULT 0,
    total_placements integer NOT NULL DEFAULT 0,
    submission_to_hire_rate numeric(7,4),
    quality_rating numeric(7,4),
    rating_label character varying(50),
    calculation_version character varying(50),
    calculated_at timestamp with time zone NOT NULL DEFAULT (now()),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT affiliate_performance_pkey PRIMARY KEY (affiliate_performance_id),
    CONSTRAINT affiliate_performance_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliate_profile (affiliate_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.affiliate_performance IS 'D17-ready performance snapshot. submission_to_hire_rate is supported; quality_rating stays nullable until the rating formula is approved.';

CREATE TABLE public.candidate_cv (
    cv_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    candidate_id uuid NOT NULL,
    title character varying(180) NOT NULL,
    creation_method character varying(40) NOT NULL,
    cv_template_id uuid,
    structured_content jsonb,
    parsed_data jsonb,
    source_file_url text,
    rendered_file_url text,
    file_name character varying(255),
    mime_type character varying(120),
    file_size_bytes bigint,
    is_primary boolean NOT NULL DEFAULT FALSE,
    status character varying(30) NOT NULL DEFAULT ('ACTIVE'::character varying),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT candidate_cv_pkey PRIMARY KEY (cv_id),
    CONSTRAINT "AK_candidate_cv_candidate_id_cv_id" UNIQUE (candidate_id, cv_id),
    CONSTRAINT candidate_cv_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT candidate_cv_cv_template_id_fkey FOREIGN KEY (cv_template_id) REFERENCES public.cv_template (cv_template_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.candidate_cv IS 'Supports PLATFORM_BUILDER, TEMPLATE_FORM and FILE_UPLOAD CV creation methods.';

CREATE TABLE public.candidate_skill (
    candidate_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    proficiency_level character varying(40),
    years_of_experience numeric(5,2),
    CONSTRAINT candidate_skill_pkey PRIMARY KEY (candidate_id, skill_id),
    CONSTRAINT candidate_skill_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE CASCADE,
    CONSTRAINT candidate_skill_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skill (skill_id) ON DELETE RESTRICT
);

CREATE TABLE public.job_requirement (
    requirement_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    job_id uuid NOT NULL,
    requirement_type character varying(30) NOT NULL,
    category character varying(120),
    content text NOT NULL,
    weight numeric(8,4),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT job_requirement_pkey PRIMARY KEY (requirement_id),
    CONSTRAINT job_requirement_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE CASCADE
);

CREATE TABLE public.job_skill (
    job_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    is_mandatory boolean NOT NULL DEFAULT FALSE,
    weight numeric(8,4),
    CONSTRAINT job_skill_pkey PRIMARY KEY (job_id, skill_id),
    CONSTRAINT job_skill_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE CASCADE,
    CONSTRAINT job_skill_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skill (skill_id) ON DELETE RESTRICT
);

CREATE TABLE public.job_status_history (
    job_status_history_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    job_id uuid NOT NULL,
    old_status character varying(30),
    new_status character varying(30) NOT NULL,
    changed_by uuid,
    reason text,
    changed_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT job_status_history_pkey PRIMARY KEY (job_status_history_id),
    CONSTRAINT job_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT job_status_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT
);

CREATE TABLE public.candidate_job_match (
    candidate_job_match_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    candidate_id uuid NOT NULL,
    job_id uuid NOT NULL,
    cv_id uuid,
    attempt_no integer NOT NULL DEFAULT 1,
    match_score numeric(5,2),
    match_tier character varying(30),
    match_summary jsonb,
    matching_reasons jsonb,
    missing_requirements jsonb,
    status character varying(30) NOT NULL DEFAULT ('GENERATED'::character varying),
    generated_at timestamp with time zone NOT NULL DEFAULT (now()),
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT candidate_job_match_pkey PRIMARY KEY (candidate_job_match_id),
    CONSTRAINT candidate_job_match_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT candidate_job_match_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_job_match_cv_owner FOREIGN KEY (candidate_id, cv_id) REFERENCES public.candidate_cv (candidate_id, cv_id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_job_match_tier FOREIGN KEY (match_tier) REFERENCES public.match_tier_config (tier_code) ON DELETE RESTRICT
);
COMMENT ON TABLE public.candidate_job_match IS 'OPTIONAL D16 capability. Keep disabled/out of baseline if pre-application job-fit recommendation is not approved.';

CREATE TABLE public.submission (
    submission_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    candidate_id uuid NOT NULL,
    cv_id uuid NOT NULL,
    job_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    source character varying(30) NOT NULL,
    status character varying(40) NOT NULL DEFAULT ('RECEIVED'::character varying),
    duplicate_of_submission_id uuid,
    note text,
    submitted_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT submission_pkey PRIMARY KEY (submission_id),
    CONSTRAINT "AK_submission_submission_id_candidate_id_job_id" UNIQUE (submission_id, candidate_id, job_id),
    CONSTRAINT fk_submission_cv_owner FOREIGN KEY (candidate_id, cv_id) REFERENCES public.candidate_cv (candidate_id, cv_id) ON DELETE RESTRICT,
    CONSTRAINT submission_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT submission_duplicate_of_submission_id_fkey FOREIGN KEY (duplicate_of_submission_id) REFERENCES public.submission (submission_id) ON DELETE SET NULL,
    CONSTRAINT submission_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT,
    CONSTRAINT submission_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.submission IS 'Submission intake/audit record. A Submission referenced by Application/Attribution as the accepted winner cannot be invalidated or have its accepted identity/source snapshot changed.';

CREATE TABLE public.application (
    application_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    job_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    accepted_submission_id uuid,
    status character varying(40) NOT NULL DEFAULT ('SUBMITTED'::character varying),
    current_stage character varying(50),
    applied_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    status_reason text,
    CONSTRAINT application_pkey PRIMARY KEY (application_id),
    CONSTRAINT application_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT application_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT,
    CONSTRAINT fk_application_accepted_submission FOREIGN KEY (accepted_submission_id, candidate_id, job_id) REFERENCES public.submission (submission_id, candidate_id, job_id) ON DELETE RESTRICT
);
COMMENT ON COLUMN public.application.status IS 'Allowed Application states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.';

CREATE TABLE public.ai_match_result (
    match_result_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    application_id uuid NOT NULL,
    attempt_no integer NOT NULL DEFAULT 1,
    match_score numeric(5,2),
    match_tier character varying(30),
    candidate_highlight jsonb,
    must_have_result jsonb,
    should_have_result jsonb,
    raw_response jsonb,
    external_reference character varying(255),
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    error_message text,
    requested_at timestamp with time zone NOT NULL DEFAULT (now()),
    completed_at timestamp with time zone,
    CONSTRAINT ai_match_result_pkey PRIMARY KEY (match_result_id),
    CONSTRAINT ai_match_result_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application (application_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ai_match_result_tier FOREIGN KEY (match_tier) REFERENCES public.match_tier_config (tier_code) ON DELETE RESTRICT
);
COMMENT ON TABLE public.ai_match_result IS 'Post-application AI screening support. Match Score/Tier/Highlight support human review; AI does not auto-reject/shortlist/hire.';
COMMENT ON COLUMN public.ai_match_result.match_tier IS 'Semantic tier (for example HIGH/MEDIUM_HIGH/MEDIUM/LOW). UI color comes from match_tier_config; AI does not make the final hiring decision.';

CREATE TABLE public.application_status_history (
    application_status_history_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    application_id uuid NOT NULL,
    old_status character varying(40),
    new_status character varying(40) NOT NULL,
    changed_by uuid,
    reason text,
    changed_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT application_status_history_pkey PRIMARY KEY (application_status_history_id),
    CONSTRAINT application_status_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application (application_id) ON DELETE RESTRICT,
    CONSTRAINT application_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE TABLE public.attribution (
    attribution_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    application_id uuid NOT NULL,
    affiliate_id uuid NOT NULL,
    winning_submission_id uuid NOT NULL,
    attribution_rule character varying(100) NOT NULL DEFAULT ('FIRST_SUBMISSION_TIMESTAMP_PRECEDENCE'::character varying),
    status character varying(30) NOT NULL DEFAULT ('ACTIVE'::character varying),
    established_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT attribution_pkey PRIMARY KEY (attribution_id),
    CONSTRAINT attribution_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliate_profile (affiliate_id) ON DELETE RESTRICT,
    CONSTRAINT attribution_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application (application_id) ON DELETE RESTRICT,
    CONSTRAINT attribution_winning_submission_id_fkey FOREIGN KEY (winning_submission_id) REFERENCES public.submission (submission_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.attribution IS 'First accepted Affiliate Submission attribution. Trigger validates source/status/Candidate/Job and blocks self-attribution by account/email/phone.';

CREATE TABLE public.interview (
    interview_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    application_id uuid NOT NULL,
    interview_round integer NOT NULL DEFAULT 1,
    interview_type character varying(50),
    scheduled_at timestamp with time zone,
    duration_minutes integer,
    location character varying(255),
    meeting_link text,
    status character varying(30) NOT NULL DEFAULT ('SCHEDULED'::character varying),
    result character varying(30),
    feedback text,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT interview_pkey PRIMARY KEY (interview_id),
    CONSTRAINT interview_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application (application_id) ON DELETE RESTRICT,
    CONSTRAINT interview_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE TABLE public.offer (
    offer_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    application_id uuid NOT NULL,
    offer_version integer NOT NULL DEFAULT 1,
    salary numeric(18,2),
    currency_code character(3) NOT NULL DEFAULT ('VND'::bpchar),
    start_date date,
    expiry_date date,
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT offer_pkey PRIMARY KEY (offer_id),
    CONSTRAINT "AK_offer_offer_id_application_id" UNIQUE (offer_id, application_id),
    CONSTRAINT offer_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application (application_id) ON DELETE RESTRICT,
    CONSTRAINT offer_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE TABLE public.offer_approval (
    approval_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    offer_id uuid NOT NULL,
    user_id uuid NOT NULL,
    approval_type character varying(50),
    status character varying(30) NOT NULL,
    comment text,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT offer_approval_pkey PRIMARY KEY (approval_id),
    CONSTRAINT offer_approval_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offer (offer_id) ON DELETE CASCADE,
    CONSTRAINT offer_approval_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.offer_approval IS 'PROPOSED. Remove if the team does not implement a separate offer approval workflow.';

CREATE TABLE public.placement (
    placement_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    application_id uuid NOT NULL,
    offer_id uuid NOT NULL,
    actual_start_date date NOT NULL,
    position character varying(180),
    department character varying(180),
    status character varying(30) NOT NULL DEFAULT ('STARTED'::character varying),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT placement_pkey PRIMARY KEY (placement_id),
    CONSTRAINT fk_placement_offer_application FOREIGN KEY (offer_id, application_id) REFERENCES public.offer (offer_id, application_id) ON DELETE RESTRICT,
    CONSTRAINT placement_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application (application_id) ON DELETE RESTRICT
);

CREATE TABLE public.commission (
    commission_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    attribution_id uuid NOT NULL,
    placement_id uuid NOT NULL,
    commission_rule_id uuid NOT NULL,
    milestone_type character varying(60),
    base_amount numeric(18,2),
    amount numeric(18,2) NOT NULL,
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    rule_snapshot jsonb NOT NULL DEFAULT ('{}'::jsonb),
    calculation_snapshot jsonb NOT NULL DEFAULT ('{}'::jsonb),
    calculated_at timestamp with time zone,
    CONSTRAINT commission_pkey PRIMARY KEY (commission_id),
    CONSTRAINT commission_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT commission_attribution_id_fkey FOREIGN KEY (attribution_id) REFERENCES public.attribution (attribution_id) ON DELETE RESTRICT,
    CONSTRAINT commission_commission_rule_id_fkey FOREIGN KEY (commission_rule_id) REFERENCES public.commission_rule (commission_rule_id) ON DELETE SET NULL,
    CONSTRAINT commission_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES public.placement (placement_id) ON DELETE RESTRICT,
    CONSTRAINT fk_commission_milestone FOREIGN KEY (milestone_type) REFERENCES public.commission_milestone (milestone_code) ON DELETE RESTRICT
);
COMMENT ON TABLE public.commission IS 'Commission eligibility/calculation domain. PAYABLE means approved for payment; payment completion is represented by payout.status=COMPLETED.';
COMMENT ON COLUMN public.commission.status IS 'Allowed Commission states. PAYABLE means approved for external/manual payment. payout.status=COMPLETED is payment source of truth.';

CREATE TABLE public.probation (
    probation_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    placement_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    result character varying(30),
    notes text,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT probation_pkey PRIMARY KEY (probation_id),
    CONSTRAINT probation_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES public.placement (placement_id) ON DELETE RESTRICT,
    CONSTRAINT probation_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE TABLE public.warranty (
    warranty_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    placement_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying(30) NOT NULL DEFAULT ('IN_PROGRESS'::character varying),
    result_note text,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT warranty_pkey PRIMARY KEY (warranty_id),
    CONSTRAINT warranty_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES public.placement (placement_id) ON DELETE RESTRICT,
    CONSTRAINT warranty_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.warranty IS 'Warranty exists only when applicable. No row may represent NOT_APPLICABLE; absence of a warranty row means not applicable.';

CREATE TABLE public.commission_adjustment (
    commission_adjustment_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    commission_id uuid NOT NULL,
    old_amount numeric(18,2) NOT NULL,
    new_amount numeric(18,2) NOT NULL,
    reason text NOT NULL,
    adjusted_by uuid NOT NULL,
    adjusted_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT commission_adjustment_pkey PRIMARY KEY (commission_adjustment_id),
    CONSTRAINT commission_adjustment_adjusted_by_fkey FOREIGN KEY (adjusted_by) REFERENCES public.app_user (user_id) ON DELETE RESTRICT,
    CONSTRAINT commission_adjustment_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.commission (commission_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.commission_adjustment IS 'Append-only Commission adjustment event. UPDATE/DELETE are prohibited; corrections require a new adjustment event.';

CREATE TABLE public.dispute (
    dispute_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    dispute_type character varying(40) NOT NULL,
    submission_id uuid,
    attribution_id uuid,
    commission_id uuid,
    raised_by uuid NOT NULL,
    description text NOT NULL,
    evidence jsonb NOT NULL DEFAULT ('[]'::jsonb),
    status character varying(30) NOT NULL DEFAULT ('OPEN'::character varying),
    resolved_by uuid,
    resolution text,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    resolved_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT dispute_pkey PRIMARY KEY (dispute_id),
    CONSTRAINT dispute_attribution_id_fkey FOREIGN KEY (attribution_id) REFERENCES public.attribution (attribution_id) ON DELETE RESTRICT,
    CONSTRAINT dispute_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.commission (commission_id) ON DELETE RESTRICT,
    CONSTRAINT dispute_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.app_user (user_id) ON DELETE RESTRICT,
    CONSTRAINT dispute_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT dispute_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submission (submission_id) ON DELETE RESTRICT
);

CREATE TABLE public.payout (
    payout_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    commission_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL,
    payout_date timestamp with time zone,
    method character varying(50),
    transaction_reference character varying(255),
    evidence_url text,
    status character varying(30) NOT NULL DEFAULT ('PENDING'::character varying),
    recorded_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    attempt_no integer NOT NULL DEFAULT 1,
    CONSTRAINT payout_pkey PRIMARY KEY (payout_id),
    CONSTRAINT payout_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.commission (commission_id) ON DELETE RESTRICT,
    CONSTRAINT payout_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.payout IS 'Manual/external payout ledger. Rows are never physically deleted. PENDING may become COMPLETED/FAILED/CANCELLED; terminal rows are immutable.';

CREATE UNIQUE INDEX admin_profile_employee_code_key ON public.admin_profile (employee_code);

CREATE UNIQUE INDEX admin_profile_user_id_key ON public.admin_profile (user_id);

CREATE INDEX "IX_affiliate_application_reviewed_by" ON public.affiliate_application (reviewed_by);

CREATE UNIQUE INDEX uq_affiliate_application_open ON public.affiliate_application (user_id) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'UNDER_REVIEW'::character varying])::text[]));

CREATE UNIQUE INDEX affiliate_performance_affiliate_id_period_start_period_end_key ON public.affiliate_performance (affiliate_id, period_start, period_end);

CREATE INDEX idx_affiliate_performance_affiliate_period ON public.affiliate_performance (affiliate_id, period_end DESC);

CREATE UNIQUE INDEX affiliate_profile_user_id_key ON public.affiliate_profile (user_id);

CREATE UNIQUE INDEX ai_match_result_application_id_attempt_no_key ON public.ai_match_result (application_id, attempt_no);

CREATE INDEX idx_ai_match_application ON public.ai_match_result (application_id, attempt_no DESC);

CREATE INDEX "IX_ai_match_result_match_tier" ON public.ai_match_result (match_tier);

CREATE INDEX idx_app_user_normalized_phone ON public.app_user (normalized_phone) WHERE (normalized_phone IS NOT NULL);

CREATE INDEX idx_app_user_status ON public.app_user (status);

CREATE UNIQUE INDEX application_candidate_id_job_id_key ON public.application (candidate_id, job_id);

CREATE INDEX idx_application_candidate ON public.application (candidate_id, updated_at DESC);

CREATE INDEX idx_application_job_status ON public.application (job_id, status);

CREATE INDEX "IX_application_accepted_submission_id_candidate_id_job_id" ON public.application (accepted_submission_id, candidate_id, job_id);

CREATE INDEX idx_application_status_history_app ON public.application_status_history (application_id, changed_at DESC);

CREATE INDEX "IX_application_status_history_changed_by" ON public.application_status_history (changed_by);

CREATE UNIQUE INDEX attribution_application_id_key ON public.attribution (application_id);

CREATE UNIQUE INDEX attribution_winning_submission_id_key ON public.attribution (winning_submission_id);

CREATE INDEX "IX_attribution_affiliate_id" ON public.attribution (affiliate_id);

CREATE INDEX idx_audit_log_actor ON public.audit_log (actor_user_id, created_at DESC);

CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id, created_at DESC);

CREATE UNIQUE INDEX candidate_user_id_key ON public.candidate (user_id);

CREATE INDEX idx_candidate_status ON public.candidate (status);

CREATE INDEX "IX_candidate_merged_into_candidate_id" ON public.candidate (merged_into_candidate_id);

CREATE UNIQUE INDEX uq_candidate_identity_email ON public.candidate (normalized_email) WHERE ((normalized_email IS NOT NULL) AND ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])));

CREATE UNIQUE INDEX uq_candidate_identity_phone ON public.candidate (normalized_phone) WHERE ((normalized_phone IS NOT NULL) AND ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])));

CREATE INDEX idx_candidate_cv_candidate ON public.candidate_cv (candidate_id, created_at DESC);

CREATE INDEX idx_candidate_cv_creation_method ON public.candidate_cv (creation_method, status);

CREATE INDEX "IX_candidate_cv_cv_template_id" ON public.candidate_cv (cv_template_id);

CREATE UNIQUE INDEX uq_candidate_cv_owner ON public.candidate_cv (candidate_id, cv_id);

CREATE UNIQUE INDEX uq_candidate_primary_cv ON public.candidate_cv (candidate_id) WHERE ((is_primary = true) AND ((status)::text = 'ACTIVE'::text));

CREATE UNIQUE INDEX candidate_job_match_candidate_id_job_id_attempt_no_key ON public.candidate_job_match (candidate_id, job_id, attempt_no);

CREATE INDEX idx_candidate_job_match_candidate_score ON public.candidate_job_match (candidate_id, match_score DESC, generated_at DESC);

CREATE INDEX idx_candidate_job_match_job ON public.candidate_job_match (job_id, generated_at DESC);

CREATE INDEX "IX_candidate_job_match_candidate_id_cv_id" ON public.candidate_job_match (candidate_id, cv_id);

CREATE INDEX "IX_candidate_job_match_match_tier" ON public.candidate_job_match (match_tier);

CREATE INDEX "IX_candidate_skill_skill_id" ON public.candidate_skill (skill_id);

CREATE INDEX idx_commission_status ON public.commission (status, created_at DESC);

CREATE INDEX "IX_commission_approved_by" ON public.commission (approved_by);

CREATE INDEX "IX_commission_commission_rule_id" ON public.commission (commission_rule_id);

CREATE INDEX "IX_commission_milestone_type" ON public.commission (milestone_type);

CREATE INDEX "IX_commission_placement_id" ON public.commission (placement_id);

CREATE UNIQUE INDEX uq_commission_attribution_placement ON public.commission (attribution_id, placement_id);

CREATE INDEX idx_commission_adjustment_commission ON public.commission_adjustment (commission_id, adjusted_at DESC);

CREATE INDEX "IX_commission_adjustment_adjusted_by" ON public.commission_adjustment (adjusted_by);

CREATE INDEX idx_commission_rule_active ON public.commission_rule (service_type_id, milestone_type, effective_from DESC) WHERE (is_active = true);

CREATE INDEX "IX_commission_rule_milestone_type" ON public.commission_rule (milestone_type);

CREATE UNIQUE INDEX uq_company_tax_code ON public.company (tax_code) WHERE (tax_code IS NOT NULL);

CREATE UNIQUE INDEX company_user_company_id_user_id_key ON public.company_user (company_id, user_id);

CREATE INDEX "IX_company_user_user_id" ON public.company_user (user_id);

CREATE UNIQUE INDEX uq_company_primary_contact ON public.company_user (company_id) WHERE ((is_primary_contact = true) AND ((status)::text = 'ACTIVE'::text));

CREATE INDEX "IX_company_verification_request_reviewed_by" ON public.company_verification_request (reviewed_by);

CREATE INDEX "IX_company_verification_request_submitted_by" ON public.company_verification_request (submitted_by);

CREATE UNIQUE INDEX uq_company_verification_open ON public.company_verification_request (company_id) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'UNDER_REVIEW'::character varying])::text[]));

CREATE UNIQUE INDEX cv_template_code_key ON public.cv_template (code);

CREATE INDEX "IX_dispute_attribution_id" ON public.dispute (attribution_id);

CREATE INDEX "IX_dispute_commission_id" ON public.dispute (commission_id);

CREATE INDEX "IX_dispute_raised_by" ON public.dispute (raised_by);

CREATE INDEX "IX_dispute_resolved_by" ON public.dispute (resolved_by);

CREATE INDEX "IX_dispute_submission_id" ON public.dispute (submission_id);

CREATE INDEX idx_email_outbox_pending ON public.email_outbox (status, next_retry_at, created_at) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'FAILED'::character varying])::text[]));

CREATE INDEX "IX_email_outbox_user_id" ON public.email_outbox (user_id);

CREATE UNIQUE INDEX internal_hr_profile_employee_code_key ON public.internal_hr_profile (employee_code);

CREATE UNIQUE INDEX internal_hr_profile_user_id_key ON public.internal_hr_profile (user_id);

CREATE UNIQUE INDEX interview_application_id_interview_round_key ON public.interview (application_id, interview_round);

CREATE INDEX "IX_interview_created_by" ON public.interview (created_by);

CREATE INDEX idx_job_active ON public.job (company_id, service_type_id, posted_at DESC) WHERE ((status)::text = 'ACTIVE'::text);

CREATE INDEX idx_job_company_status ON public.job (company_id, status);

CREATE INDEX idx_job_service_type_status ON public.job (service_type_id, status);

CREATE INDEX idx_job_visibility_status ON public.job (visibility, status, posted_at DESC);

CREATE INDEX "IX_job_created_by" ON public.job (created_by);

CREATE INDEX "IX_job_requirement_job_id" ON public.job_requirement (job_id);

CREATE INDEX "IX_job_skill_skill_id" ON public.job_skill (skill_id);

CREATE INDEX idx_job_status_history_job ON public.job_status_history (job_id, changed_at DESC);

CREATE INDEX "IX_job_status_history_changed_by" ON public.job_status_history (changed_by);

CREATE INDEX idx_notification_unread ON public.notification (user_id, created_at DESC) WHERE (is_read = false);

CREATE INDEX idx_notification_user_created ON public.notification (user_id, created_at DESC);

CREATE INDEX "IX_offer_created_by" ON public.offer (created_by);

CREATE UNIQUE INDEX offer_application_id_offer_version_key ON public.offer (application_id, offer_version);

CREATE UNIQUE INDEX uq_offer_application_pair ON public.offer (offer_id, application_id);

CREATE INDEX "IX_offer_approval_user_id" ON public.offer_approval (user_id);

CREATE UNIQUE INDEX offer_approval_offer_id_user_id_key ON public.offer_approval (offer_id, user_id);

CREATE INDEX idx_payout_commission_status ON public.payout (commission_id, status, created_at DESC);

CREATE INDEX "IX_payout_recorded_by" ON public.payout (recorded_by);

CREATE UNIQUE INDEX uq_payout_attempt ON public.payout (commission_id, attempt_no);

CREATE UNIQUE INDEX permission_code_key ON public.permission (code);

CREATE INDEX "IX_placement_offer_id_application_id" ON public.placement (offer_id, application_id);

CREATE UNIQUE INDEX placement_application_id_key ON public.placement (application_id);

CREATE UNIQUE INDEX placement_offer_id_key ON public.placement (offer_id);

CREATE INDEX "IX_probation_updated_by" ON public.probation (updated_by);

CREATE UNIQUE INDEX probation_placement_id_key ON public.probation (placement_id);

CREATE INDEX idx_refresh_token_active ON public.refresh_token (user_id, expires_at DESC) WHERE (revoked_at IS NULL);

CREATE INDEX "IX_refresh_token_replaced_by_token_id" ON public.refresh_token (replaced_by_token_id);

CREATE UNIQUE INDEX refresh_token_token_hash_key ON public.refresh_token (token_hash);

CREATE UNIQUE INDEX role_code_key ON public.role (code);

CREATE INDEX "IX_role_permission_permission_id" ON public.role_permission (permission_id);

CREATE UNIQUE INDEX service_type_code_key ON public.service_type (code);

CREATE UNIQUE INDEX skill_normalized_name_key ON public.skill (normalized_name);

CREATE INDEX idx_submission_job_candidate ON public.submission (job_id, candidate_id, submitted_at);

CREATE INDEX idx_submission_submitted_by ON public.submission (submitted_by, submitted_at DESC);

CREATE INDEX "IX_submission_candidate_id_cv_id" ON public.submission (candidate_id, cv_id);

CREATE INDEX "IX_submission_duplicate_of_submission_id" ON public.submission (duplicate_of_submission_id);

CREATE UNIQUE INDEX uq_submission_identity ON public.submission (submission_id, candidate_id, job_id);

CREATE UNIQUE INDEX uq_submission_one_accepted ON public.submission (job_id, candidate_id) WHERE ((status)::text = 'ACCEPTED'::text);

CREATE INDEX idx_user_role_active_user ON public.user_role (user_id, role_id) WHERE ((status)::text = 'ACTIVE'::text);

CREATE INDEX idx_user_role_role_id ON public.user_role (role_id);

CREATE INDEX "IX_user_role_assigned_by" ON public.user_role (assigned_by);

CREATE INDEX "IX_user_role_revoked_by" ON public.user_role (revoked_by);

CREATE INDEX idx_user_token_active ON public.user_token (user_id, token_type, expires_at) WHERE (used_at IS NULL);

CREATE INDEX idx_user_token_lookup ON public.user_token (user_id, token_type, expires_at DESC);

CREATE INDEX "IX_warranty_updated_by" ON public.warranty (updated_by);

CREATE UNIQUE INDEX warranty_placement_id_key ON public.warranty (placement_id);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260918040739_InitialCreate', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.affiliate_profile ADD bank_account_holder character varying(180);

ALTER TABLE public.affiliate_profile ADD bank_account_number character varying(50);

ALTER TABLE public.affiliate_profile ADD bank_branch character varying(180);

ALTER TABLE public.affiliate_profile ADD bank_name character varying(100);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260919095201_AddAffiliateBankAccount', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE public.service_type_allowed_role (
    service_type_id uuid NOT NULL,
    role_id uuid NOT NULL,
    can_view boolean NOT NULL DEFAULT FALSE,
    can_submit boolean NOT NULL DEFAULT FALSE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT service_type_allowed_role_pkey PRIMARY KEY (service_type_id, role_id),
    CONSTRAINT service_type_allowed_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role (role_id) ON DELETE RESTRICT,
    CONSTRAINT service_type_allowed_role_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES public.service_type (service_type_id) ON DELETE CASCADE
);

CREATE INDEX idx_service_type_allowed_role_view ON public.service_type_allowed_role (role_id, can_view);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260921110637_AddServiceTypeAllowedRole', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.ai_match_result ADD dispatch_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.ai_match_result ADD failure_code character varying(100);

ALTER TABLE public.ai_match_result ADD last_dispatched_at timestamp with time zone;

ALTER TABLE public.ai_match_result ADD model_version character varying(255);

ALTER TABLE public.ai_match_result ADD processing_started_at timestamp with time zone;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260924124819_AddMf03ObservabilityAudit', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.candidate_cv ADD uploaded_by_user_id uuid;

CREATE INDEX idx_candidate_cv_uploaded_by ON public.candidate_cv (uploaded_by_user_id);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260926142500_AddCandidateCvUploadProvenance', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.app_user ADD failed_login_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.app_user ADD lockout_end_at timestamp with time zone;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260926144500_AddLoginLockout', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE INDEX idx_audit_log_correlation ON public.audit_log (correlation_id, created_at DESC);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260926150000_AddAuditCorrelationIndex', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.offer ADD offer_document_url text;

ALTER TABLE public.offer ADD sent_at timestamp with time zone;

ALTER TABLE public.offer ADD responded_at timestamp with time zone;

ALTER TABLE public.offer ADD decline_reason text;

ALTER TABLE public.offer ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.offer DROP CONSTRAINT IF EXISTS ck_offer_date_range;

ALTER TABLE public.placement ADD confirmed_by uuid;

ALTER TABLE public.placement ADD confirmed_at timestamp with time zone NOT NULL DEFAULT (now());

ALTER TABLE public.placement ADD confirmation_note text;

ALTER TABLE public.placement ADD CONSTRAINT placement_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL;

ALTER TABLE public.application ADD planned_start_date date;

ALTER TABLE public.application ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.interview ADD recorded_by uuid;

ALTER TABLE public.interview ADD recorded_at timestamp with time zone;

ALTER TABLE public.interview ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.interview ADD CONSTRAINT interview_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL;

CREATE TABLE public.interview_status_history (
    interview_status_history_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    interview_id uuid NOT NULL,
    old_status character varying(30),
    new_status character varying(30) NOT NULL,
    old_scheduled_at timestamp with time zone,
    new_scheduled_at timestamp with time zone,
    changed_by uuid,
    reason text,
    changed_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT interview_status_history_pkey PRIMARY KEY (interview_status_history_id),
    CONSTRAINT interview_status_history_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interview (interview_id) ON DELETE RESTRICT,
    CONSTRAINT interview_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_interview_status_history_interview ON public.interview_status_history (interview_id, changed_at DESC);

CREATE TABLE public.interview_participant (
    interview_participant_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    interview_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL DEFAULT ('INTERVIEWER'::character varying),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT interview_participant_pkey PRIMARY KEY (interview_participant_id),
    CONSTRAINT interview_participant_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interview (interview_id) ON DELETE CASCADE,
    CONSTRAINT interview_participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_interview_participant_interview_user ON public.interview_participant (interview_id, user_id);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260926153000_AddMf04SchemaReconcile', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD benefits text;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260930091617_AddJobBenefits', '8.0.11');

COMMIT;

START TRANSACTION;

UPDATE public.job SET visibility = 'INTERNAL_ONLY' WHERE visibility = 'PRIVATE';

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261001022626_ReplacePrivateJobVisibility', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job DROP CONSTRAINT IF EXISTS ck_job_visibility;

ALTER TABLE public.job ADD CONSTRAINT ck_job_visibility CHECK (visibility IN ('PUBLIC','PARTNER_ONLY','INTERNAL_ONLY'));

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261001023151_AddJobVisibilityConstraint', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE public.submission_consent (
    consent_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    submission_id uuid NOT NULL,
    recipient_email character varying(255) NOT NULL,
    token_hash character varying(64) NOT NULL,
    status character varying(20) NOT NULL,
    requested_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    responded_at timestamp with time zone,
    response_ip character varying(64),
    response_user_agent character varying(512),
    email_send_count integer NOT NULL DEFAULT 0,
    email_sent_at timestamp with time zone,
    last_email_error character varying(1000),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT submission_consent_pkey PRIMARY KEY (consent_id),
    CONSTRAINT ck_submission_consent_expiry CHECK (expires_at > requested_at),
    CONSTRAINT ck_submission_consent_status CHECK (status IN ('PENDING','CONFIRMED','DECLINED','EXPIRED')),
    CONSTRAINT submission_consent_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submission (submission_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_submission_one_pending_consent ON public.submission (job_id, candidate_id) WHERE ((status)::text = 'PENDING_CONSENT'::text);

CREATE INDEX idx_submission_consent_pending_expiry ON public.submission_consent (status, expires_at) WHERE status = 'PENDING';

CREATE UNIQUE INDEX uq_submission_consent_submission ON public.submission_consent (submission_id);

CREATE UNIQUE INDEX uq_submission_consent_token_hash ON public.submission_consent (token_hash);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261002115334_AddSubmissionCandidateConsent', '8.0.11');

COMMIT;

START TRANSACTION;

DROP TABLE IF EXISTS public.job_location;

ALTER TABLE public.job ADD COLUMN IF NOT EXISTS working_time character varying(2000);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261002120000_AddJobWorkingTimeAndRemoveJobLocations', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.submission_consent DROP CONSTRAINT ck_submission_consent_status;

ALTER TABLE public.submission_consent ADD CONSTRAINT ck_submission_consent_status CHECK (status IN ('PENDING','CONFIRMED','DECLINED','EXPIRED','CANCELLED'));

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261002120226_AddCancelledSubmissionConsentStatus', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.submission DROP CONSTRAINT IF EXISTS submission_status_check;

ALTER TABLE public.submission ADD CONSTRAINT submission_status_check CHECK (status IN ('RECEIVED','PENDING_CONSENT','ACCEPTED','BLOCKED_DUPLICATE','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED'));

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261002125908_ExpandSubmissionStatusForConsent', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD COLUMN IF NOT EXISTS min_experience_years integer;

ALTER TABLE public.job ADD COLUMN IF NOT EXISTS max_experience_years integer;

ALTER TABLE public.job ADD COLUMN IF NOT EXISTS salary_negotiable boolean NOT NULL DEFAULT FALSE;

ALTER TABLE public.job ADD COLUMN IF NOT EXISTS salary_note character varying(1000);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261002130000_AddJobExperienceAndSalaryNegotiation', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.candidate_cv DROP CONSTRAINT IF EXISTS candidate_cv_creation_method_check; ALTER TABLE public.candidate_cv DROP CONSTRAINT IF EXISTS candidate_cv_status_check; ALTER TABLE public.candidate_cv DROP CONSTRAINT IF EXISTS ck_candidate_cv_creation_method;

COMMENT ON TABLE public.candidate_cv IS 'Supports CVs created by candidates and submission-scoped CVs uploaded by Affiliates.';

ALTER TABLE public.candidate_cv ADD CONSTRAINT candidate_cv_creation_method_check CHECK (creation_method IN ('PLATFORM_BUILDER','TEMPLATE_FORM','FILE_UPLOAD','AFFILIATE_UPLOAD'));

ALTER TABLE public.candidate_cv ADD CONSTRAINT candidate_cv_status_check CHECK (status IN ('DRAFT','PENDING_CONSENT','ACTIVE','ARCHIVED','DELETED'));

ALTER TABLE public.candidate_cv ADD CONSTRAINT ck_candidate_cv_creation_method CHECK (((creation_method = 'PLATFORM_BUILDER' AND structured_content IS NOT NULL) OR (creation_method = 'TEMPLATE_FORM' AND structured_content IS NOT NULL AND cv_template_id IS NOT NULL) OR (creation_method IN ('FILE_UPLOAD','AFFILIATE_UPLOAD') AND source_file_url IS NOT NULL)));

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261002131943_AlignAffiliateCvConstraints', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.application
    DROP CONSTRAINT IF EXISTS application_status_check;

ALTER TABLE public.application
    DROP CONSTRAINT IF EXISTS ck_application_status;

ALTER TABLE public.application
    ADD CONSTRAINT ck_application_status
    CHECK (status IN (
        'SUBMITTED',
        'SCREENING',
        'SHORTLISTED',
        'REJECTED',
        'INTERVIEW',
        'BACKUP',
        'BACKUP_NOT_SELECTED',
        'INTERVIEW_FAILED',
        'OFFER_PENDING',
        'OFFER_ACCEPTED',
        'OFFER_DECLINED',
        'NOT_STARTED',
        'WITHDRAWN',
        'PLACED',
        'CLOSED'
    )) NOT VALID;

ALTER TABLE public.application
    VALIDATE CONSTRAINT ck_application_status;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261002134014_RepairApplicationStatusConstraint', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.candidate_cv ADD CONSTRAINT ck_candidate_cv_affiliate_uploader CHECK (creation_method <> 'AFFILIATE_UPLOAD' OR uploaded_by_user_id IS NOT NULL);

ALTER TABLE public.candidate_cv ADD CONSTRAINT candidate_cv_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261003075822_EnforceCandidateCvUploaderIntegrity', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.ai_match_result ADD next_attempt_at timestamp with time zone;

CREATE INDEX idx_ai_match_result_pending_dispatch ON public.ai_match_result (status, next_attempt_at) WHERE status = 'PENDING';

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261003160827_AddMf03BoundedRetryBackoff', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.submission_consent ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261003162029_AddSubmissionConsentConcurrencyToken', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.ai_match_result DROP CONSTRAINT IF EXISTS ai_match_result_status_check;

UPDATE public.ai_match_result SET status = 'COMPLETED' WHERE status = 'SUCCESS';

ALTER TABLE public.ai_match_result ADD CONSTRAINT ai_match_result_status_check CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','UNAVAILABLE'));

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261003163733_AlignAiMatchCompletedStatus', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job_status_history ADD reason_code character varying(100);

ALTER TABLE public.job_status_history ADD reason_text character varying(2000);

UPDATE public.job_status_history SET reason_text = reason WHERE reason IS NOT NULL;

ALTER TABLE public.job_status_history DROP COLUMN reason;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261003190000_AddJobStatusReasonCodes', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261003200000_AddJobConcurrencyToken', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_actor_user_id_fkey;

COMMENT ON TABLE public.audit_log IS 'Append-only audit trail with actor and source context.';

ALTER TABLE public.audit_log ADD actor_type character varying(30) NOT NULL DEFAULT 'SYSTEM';

ALTER TABLE public.audit_log ADD event_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.audit_log ADD service_name character varying(80);

ALTER TABLE public.audit_log ADD source character varying(30) NOT NULL DEFAULT 'APPLICATION';

-- Databases built only from EF migrations do not have this trigger.
DO $guard$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_audit_log_no_update'
          AND tgrelid = 'public.audit_log'::regclass
    ) THEN
        ALTER TABLE public.audit_log DISABLE TRIGGER trg_audit_log_no_update;
    END IF;
END
$guard$;

UPDATE public.audit_log
SET actor_type = CASE
        WHEN actor_user_id IS NOT NULL THEN 'USER'
        WHEN action IN ('INSERT', 'UPDATE', 'DELETE') THEN 'DATABASE_TRIGGER'
        WHEN action LIKE 'AI_SCORING_%' THEN 'SERVICE'
        WHEN ip_address IS NOT NULL OR user_agent IS NOT NULL OR correlation_id IS NOT NULL THEN 'ANONYMOUS'
        ELSE 'SYSTEM'
    END,
    source = CASE
        WHEN action IN ('INSERT', 'UPDATE', 'DELETE') THEN 'DATABASE_TRIGGER'
        WHEN action IN ('AI_SCORING_REQUESTED', 'AI_SCORING_RETRY_REQUESTED', 'AI_SCORING_COMPLETED') THEN 'INTEGRATION'
        WHEN action = 'AI_SCORING_RETRY_SCHEDULED' THEN 'BACKGROUND_WORKER'
        WHEN action = 'AI_SCORING_FAILED'
             AND COALESCE(new_values ->> 'failureCode', '') LIKE '%RETRY_EXHAUSTED' THEN 'BACKGROUND_WORKER'
        WHEN action = 'AI_SCORING_FAILED' THEN 'INTEGRATION'
        WHEN ip_address IS NOT NULL OR user_agent IS NOT NULL OR correlation_id IS NOT NULL THEN 'API'
        WHEN actor_user_id IS NOT NULL THEN 'APPLICATION'
        ELSE 'BACKGROUND_WORKER'
    END,
    service_name = CASE
        WHEN action IN ('INSERT', 'UPDATE', 'DELETE') THEN 'POSTGRESQL_TRIGGER'
        WHEN action IN ('AI_SCORING_REQUESTED', 'AI_SCORING_RETRY_REQUESTED') THEN 'MF02_MF03_TRIGGER'
        WHEN action = 'AI_SCORING_RETRY_SCHEDULED' THEN 'MF03_DISPATCHER'
        WHEN action = 'AI_SCORING_FAILED'
             AND COALESCE(new_values ->> 'failureCode', '') LIKE '%RETRY_EXHAUSTED' THEN 'MF03_DISPATCHER'
        WHEN action IN ('AI_SCORING_COMPLETED', 'AI_SCORING_FAILED') THEN 'MF03'
        ELSE NULL
    END,
    event_version = 1;

-- Databases built only from EF migrations do not have this trigger.
DO $guard$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_audit_log_no_update'
          AND tgrelid = 'public.audit_log'::regclass
    ) THEN
        ALTER TABLE public.audit_log ENABLE TRIGGER trg_audit_log_no_update;
    END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.audit_business_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_old jsonb;
    v_new jsonb;
    v_id uuid;
    v_actor uuid;
    v_correlation uuid;
    v_ip inet;
    v_user_agent text;
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

    v_actor := current_actor_user_id();
    BEGIN
        v_correlation := NULLIF(current_setting('app.correlation_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
        v_correlation := NULL;
    END;
    BEGIN
        v_ip := NULLIF(current_setting('app.ip_address', true), '')::inet;
    EXCEPTION WHEN others THEN
        v_ip := NULL;
    END;
    v_user_agent := NULLIF(current_setting('app.user_agent', true), '');

    INSERT INTO public.audit_log(
        actor_user_id,
        actor_type,
        action,
        source,
        service_name,
        event_version,
        entity_type,
        entity_id,
        old_values,
        new_values,
        correlation_id,
        ip_address,
        user_agent,
        created_at
    )
    VALUES (
        v_actor,
        CASE WHEN v_actor IS NULL THEN 'DATABASE_TRIGGER' ELSE 'USER' END,
        TG_OP,
        'DATABASE_TRIGGER',
        'POSTGRESQL_TRIGGER',
        1,
        TG_ARGV[0],
        v_id,
        v_old,
        v_new,
        v_correlation,
        v_ip,
        v_user_agent,
        now()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE INDEX idx_audit_log_actor_type ON public.audit_log (actor_type, created_at DESC);

CREATE INDEX idx_audit_log_service ON public.audit_log (service_name, created_at DESC) WHERE service_name IS NOT NULL;

CREATE INDEX idx_audit_log_source ON public.audit_log (source, created_at DESC);

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_type_check CHECK (actor_type IN ('USER', 'ANONYMOUS', 'SYSTEM', 'SERVICE', 'DATABASE_TRIGGER'));

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_identity_check CHECK ((actor_user_id IS NULL AND actor_type <> 'USER') OR (actor_user_id IS NOT NULL AND actor_type = 'USER'));

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_event_version_check CHECK (event_version >= 1);

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_source_check CHECK (source IN ('API', 'APPLICATION', 'BACKGROUND_WORKER', 'INTEGRATION', 'DATABASE_TRIGGER'));

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_service_actor_check CHECK (actor_type <> 'SERVICE' OR service_name IS NOT NULL);

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261004043422_AddAuditContextMetadata', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.notification
DROP CONSTRAINT IF EXISTS ck_notification_type;

ALTER TABLE public.notification
ADD CONSTRAINT ck_notification_type CHECK (
    notification_type IN (
        'ACCOUNT', 'COMPANY', 'JOB', 'SUBMISSION',
        'SUBMISSION_CONSENT_RESULT', 'JOB_FIT', 'APPLICATION_STATUS',
        'INTERVIEW', 'OFFER', 'AFFILIATE', 'COMMISSION', 'PAYOUT', 'SYSTEM'
    )
);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261004054727_ExpandNotificationTypeForSubmissionConsent', '8.0.11');

COMMIT;

START TRANSACTION;

DELETE FROM public.role_permission AS role_permission
USING public.role AS role, public.permission AS permission
WHERE role_permission.role_id = role.role_id
  AND role_permission.permission_id = permission.permission_id
  AND role.code = 'INTERNAL_HR'
  AND permission.code IN ('application.decide_backup',
'interview.manage',
'interview.record_result',
'offer.manage',
'offer.send',
'offer.withdraw',
'placement.manage',
'placement.confirm',
'application.mark_not_started');

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261005090000_RestrictInternalHrRecruitmentMutations', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.candidate_cv ADD affiliate_reuse_changed_at timestamp with time zone;

ALTER TABLE public.candidate_cv ADD affiliate_reuse_changed_by_user_id uuid;

ALTER TABLE public.candidate_cv ADD affiliate_reuse_concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.candidate_cv ADD affiliate_reuse_status character varying(20);

UPDATE public.candidate_cv SET affiliate_reuse_status = 'NOT_GRANTED' WHERE creation_method = 'AFFILIATE_UPLOAD' AND affiliate_reuse_status IS NULL;

INSERT INTO public.permission (code, resource, action, description, is_active, created_at, updated_at)
VALUES (
    'cv.affiliate_reuse.manage_own',
    'candidate_cv',
    'affiliate_reuse_manage_own',
    'Manage whether an Affiliate may reuse an uploaded CV for new consent requests',
    true,
    now(),
    now())
ON CONFLICT (code) DO UPDATE
SET resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.role r
JOIN public.permission p ON p.code = 'cv.affiliate_reuse.manage_own'
WHERE r.code = 'CANDIDATE'
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE INDEX idx_candidate_cv_affiliate_reuse ON public.candidate_cv (uploaded_by_user_id, affiliate_reuse_status, status);

CREATE INDEX "IX_candidate_cv_affiliate_reuse_changed_by_user_id" ON public.candidate_cv (affiliate_reuse_changed_by_user_id);

ALTER TABLE public.candidate_cv ADD CONSTRAINT ck_candidate_cv_affiliate_reuse_status CHECK (((creation_method = 'AFFILIATE_UPLOAD' AND affiliate_reuse_status IN ('NOT_GRANTED','ALLOWED','REVOKED')) OR (creation_method <> 'AFFILIATE_UPLOAD' AND affiliate_reuse_status IS NULL)));

ALTER TABLE public.candidate_cv ADD CONSTRAINT candidate_cv_reuse_changed_by_user_id_fkey FOREIGN KEY (affiliate_reuse_changed_by_user_id) REFERENCES public.app_user (user_id) ON DELETE SET NULL;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261005133542_AddCandidateCvAffiliateReuseControl', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.application_status_history ADD reason_code character varying(100);

ALTER TABLE public.application ADD status_reason_code character varying(100);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261006012340_AddApplicationReasonCode', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.candidate_cv DROP CONSTRAINT candidate_cv_creation_method_check;

ALTER TABLE public.candidate_cv DROP CONSTRAINT ck_candidate_cv_creation_method;

ALTER TABLE public.candidate_cv ADD adopted_from_cv_id uuid;

CREATE UNIQUE INDEX ux_candidate_cv_adopted_from ON public.candidate_cv (adopted_from_cv_id) WHERE adopted_from_cv_id IS NOT NULL;

ALTER TABLE public.candidate_cv ADD CONSTRAINT candidate_cv_creation_method_check CHECK (creation_method IN ('PLATFORM_BUILDER','TEMPLATE_FORM','FILE_UPLOAD','AFFILIATE_UPLOAD','AFFILIATE_ADOPTED'));

ALTER TABLE public.candidate_cv ADD CONSTRAINT ck_candidate_cv_adoption_source CHECK (((creation_method = 'AFFILIATE_ADOPTED' AND adopted_from_cv_id IS NOT NULL) OR (creation_method <> 'AFFILIATE_ADOPTED' AND adopted_from_cv_id IS NULL)));

ALTER TABLE public.candidate_cv ADD CONSTRAINT ck_candidate_cv_creation_method CHECK (((creation_method = 'PLATFORM_BUILDER' AND structured_content IS NOT NULL) OR (creation_method = 'TEMPLATE_FORM' AND structured_content IS NOT NULL AND cv_template_id IS NOT NULL) OR (creation_method IN ('FILE_UPLOAD','AFFILIATE_UPLOAD','AFFILIATE_ADOPTED') AND source_file_url IS NOT NULL)));

ALTER TABLE public.candidate_cv ADD CONSTRAINT candidate_cv_adopted_from_cv_id_fkey FOREIGN KEY (adopted_from_cv_id) REFERENCES public.candidate_cv (cv_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261006143716_AddCandidateAffiliateCvAdoption', '8.0.11');

COMMIT;

START TRANSACTION;

DO $$
BEGIN
    IF EXISTS (
        SELECT lower(btrim(email))
        FROM public.app_user
        GROUP BY lower(btrim(email))
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot backfill user_email_identity: duplicate normalized app_user emails exist.';
    END IF;
END
$$;

CREATE TABLE public.candidate_identity_claim (
    claim_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    requester_user_id uuid NOT NULL,
    requester_candidate_id uuid NOT NULL,
    target_candidate_id uuid,
    asserted_email character varying(255) NOT NULL,
    normalized_email character varying(255) NOT NULL,
    token_hash character varying(255) NOT NULL,
    status character varying(40) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    resend_count integer NOT NULL DEFAULT 0,
    last_sent_at timestamp with time zone,
    verified_at timestamp with time zone,
    completed_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_reason character varying(1000),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid()),
    CONSTRAINT candidate_identity_claim_pkey PRIMARY KEY (claim_id),
    CONSTRAINT ck_candidate_identity_claim_attempts CHECK (attempt_count >= 0 AND resend_count >= 0),
    CONSTRAINT ck_candidate_identity_claim_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_candidate_identity_claim_status CHECK (status IN ('PENDING_VERIFICATION','VERIFIED','COMPLETED','PENDING_ADMIN_REVIEW','REJECTED','EXPIRED','CANCELLED')),
    CONSTRAINT candidate_identity_claim_requester_candidate_id_fkey FOREIGN KEY (requester_candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT candidate_identity_claim_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT,
    CONSTRAINT candidate_identity_claim_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT candidate_identity_claim_target_candidate_id_fkey FOREIGN KEY (target_candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT
);

CREATE TABLE public.user_email_identity (
    email_identity_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    user_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    normalized_email character varying(255) NOT NULL,
    kind character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    verification_source character varying(40) NOT NULL,
    verified_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid()),
    CONSTRAINT user_email_identity_pkey PRIMARY KEY (email_identity_id),
    CONSTRAINT ck_user_email_identity_kind CHECK (kind IN ('PRIMARY','ALIAS')),
    CONSTRAINT ck_user_email_identity_revoked_at CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL),
    CONSTRAINT ck_user_email_identity_status CHECK (status IN ('PENDING','VERIFIED','REVOKED')),
    CONSTRAINT ck_user_email_identity_verified_at CHECK (status <> 'VERIFIED' OR verified_at IS NOT NULL),
    CONSTRAINT user_email_identity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE CASCADE
);

INSERT INTO public.user_email_identity
    (email_identity_id, user_id, email, normalized_email, kind, status,
     verification_source, verified_at, created_at, updated_at, concurrency_token)
SELECT
    gen_random_uuid(),
    user_id,
    email,
    lower(btrim(email)),
    'PRIMARY',
    CASE WHEN email_verified_at IS NULL THEN 'PENDING' ELSE 'VERIFIED' END,
    'REGISTRATION',
    email_verified_at,
    created_at,
    updated_at,
    gen_random_uuid()
FROM public.app_user;

CREATE INDEX idx_candidate_identity_claim_status_expiry ON public.candidate_identity_claim (status, expires_at);

CREATE INDEX "IX_candidate_identity_claim_requester_candidate_id" ON public.candidate_identity_claim (requester_candidate_id);

CREATE INDEX "IX_candidate_identity_claim_reviewed_by" ON public.candidate_identity_claim (reviewed_by);

CREATE UNIQUE INDEX uq_candidate_identity_claim_active_requester_email ON public.candidate_identity_claim (requester_user_id, normalized_email) WHERE status IN ('PENDING_VERIFICATION','VERIFIED','PENDING_ADMIN_REVIEW');

CREATE UNIQUE INDEX uq_candidate_identity_claim_active_target ON public.candidate_identity_claim (target_candidate_id) WHERE target_candidate_id IS NOT NULL AND status IN ('VERIFIED','PENDING_ADMIN_REVIEW');

CREATE UNIQUE INDEX uq_candidate_identity_claim_token_hash ON public.candidate_identity_claim (token_hash);

CREATE INDEX idx_user_email_identity_user_status ON public.user_email_identity (user_id, status);

CREATE UNIQUE INDEX uq_user_email_identity_active_email ON public.user_email_identity (normalized_email) WHERE status <> 'REVOKED';

CREATE UNIQUE INDEX uq_user_email_identity_primary_user ON public.user_email_identity (user_id, kind) WHERE kind = 'PRIMARY' AND status <> 'REVOKED';

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261007075712_AddCandidateIdentityClaims', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE UNIQUE INDEX ux_interview_one_scheduled_per_application ON public.interview (application_id) WHERE status = 'SCHEDULED';

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261008090000_EnforceSingleScheduledInterview', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.job_status_history (
            job_id,
            old_status,
            new_status,
            changed_by,
            reason_code,
            reason_text,
            changed_at
        )
        VALUES (
            NEW.job_id,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
            NEW.status,
            public.current_actor_user_id(),
            NULL,
            NEW.status_reason,
            now()
        );
    END IF;

    RETURN NEW;
END;
$function$;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261009051500_RepairJobStatusHistoryTrigger', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE public.service_fee (
    service_fee_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    placement_id uuid NOT NULL,
    company_id uuid NOT NULL,
    base_salary numeric(18,2) NOT NULL,
    fee_multiplier numeric(6,3) NOT NULL,
    amount numeric(18,2) NOT NULL,
    currency_code character(3) NOT NULL,
    due_date date NOT NULL,
    status character varying(20) NOT NULL DEFAULT ('PENDING'::character varying),
    paid_at timestamp with time zone,
    payment_reference character varying(200),
    recorded_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT service_fee_pkey PRIMARY KEY (service_fee_id),
    CONSTRAINT ck_service_fee_amounts CHECK (amount >= 0 AND base_salary >= 0 AND fee_multiplier > 0),
    CONSTRAINT ck_service_fee_paid CHECK ((status = 'PAID') = (paid_at IS NOT NULL)),
    CONSTRAINT ck_service_fee_status CHECK (status IN ('PENDING','PAID','OVERDUE','CANCELLED')),
    CONSTRAINT service_fee_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company (company_id) ON DELETE RESTRICT,
    CONSTRAINT service_fee_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES public.placement (placement_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.service_fee IS 'MF-05 service fee the Client owes for one HEADHUNT_COD placement. Paid outside the system; Platform Admin records payment.';

CREATE INDEX idx_service_fee_company_status ON public.service_fee (company_id, status);

CREATE INDEX idx_service_fee_status_due_date ON public.service_fee (status, due_date);

CREATE UNIQUE INDEX service_fee_placement_id_key ON public.service_fee (placement_id);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261009083326_AddServiceFee', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE public.system_setting (
    setting_key character varying(100) NOT NULL,
    value character varying(100) NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT system_setting_pkey PRIMARY KEY (setting_key),
    CONSTRAINT system_setting_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.system_setting IS 'Admin overrides of configurable business numbers. Keys, defaults and ranges are declared in code (BusinessSettingKeys); no row means the documented default applies.';

CREATE INDEX "IX_system_setting_updated_by" ON public.system_setting (updated_by);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261009152756_AddSystemSetting', '8.0.11');

COMMIT;

START TRANSACTION;

-- 1. Cập nhật dữ liệu seed cũ bị sai ma trận: CV_SOURCING và HEADHUNT_COD phải là PARTNER_ONLY
UPDATE public.job j
SET visibility = 'PARTNER_ONLY', updated_at = now()
FROM public.service_type s
WHERE j.service_type_id = s.service_type_id
  AND s.code IN ('CV_SOURCING', 'HEADHUNT_COD')
  AND j.visibility = 'PUBLIC';

-- 2. Hàm và Trigger bảo đảm toàn vẹn ma trận visibility x service_type
CREATE OR REPLACE FUNCTION public.enforce_job_visibility_matrix()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_service_code text;
BEGIN
    SELECT code INTO v_service_code
    FROM public.service_type
    WHERE service_type_id = NEW.service_type_id;

    IF v_service_code = 'CV_APPLICATION' AND NEW.visibility NOT IN ('PUBLIC', 'INTERNAL_ONLY') THEN
        RAISE EXCEPTION 'CV_APPLICATION chỉ cho phép visibility là PUBLIC hoặc INTERNAL_ONLY. Hiện tại: %', NEW.visibility;
    ELSIF v_service_code IN ('CV_SOURCING', 'HEADHUNT_COD') AND NEW.visibility NOT IN ('PARTNER_ONLY', 'INTERNAL_ONLY') THEN
        RAISE EXCEPTION '% chỉ cho phép visibility là PARTNER_ONLY hoặc INTERNAL_ONLY. Hiện tại: %', v_service_code, NEW.visibility;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_job_visibility_matrix ON public.job;
CREATE TRIGGER trg_job_visibility_matrix
BEFORE INSERT OR UPDATE OF service_type_id, visibility ON public.job
FOR EACH ROW
EXECUTE FUNCTION public.enforce_job_visibility_matrix();

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261009223000_FixJobVisibilityMatrix', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD sourcing_target integer;

ALTER TABLE public.job ADD sourcing_price_per_cv numeric(18,2);

ALTER TABLE public.job ADD fee_multiplier numeric(5,2);

ALTER TABLE public.job ADD warranty_days integer;

ALTER TABLE public.job ADD payment_due_days integer;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261009233000_AddJobCommercialTerms', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE public.job_posting_package (
    package_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    price numeric(18,2) NOT NULL DEFAULT 0.0,
    duration_days integer NOT NULL DEFAULT 30,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT job_posting_package_pkey PRIMARY KEY (package_id)
);

CREATE UNIQUE INDEX idx_job_posting_package_code ON public.job_posting_package (code);

ALTER TABLE public.job ADD posting_package_id uuid;

ALTER TABLE public.job ADD expires_at timestamp with time zone;

ALTER TABLE public.job ADD CONSTRAINT job_posting_package_id_fkey FOREIGN KEY (posting_package_id) REFERENCES public.job_posting_package (package_id) ON DELETE SET NULL;

CREATE TABLE public.job_posting_fee (
    posting_fee_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    job_id uuid NOT NULL,
    package_id uuid NOT NULL,
    company_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL DEFAULT 0.0,
    currency_code character varying(10) NOT NULL DEFAULT 'VND',
    status character varying(50) NOT NULL DEFAULT 'PENDING',
    paid_at timestamp with time zone,
    payment_reference character varying(200),
    recorded_by uuid,
    activated_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT job_posting_fee_pkey PRIMARY KEY (posting_fee_id),
    CONSTRAINT job_posting_fee_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE CASCADE,
    CONSTRAINT job_posting_fee_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.job_posting_package (package_id) ON DELETE RESTRICT,
    CONSTRAINT job_posting_fee_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company (company_id) ON DELETE RESTRICT,
    CONSTRAINT job_posting_fee_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_job_posting_fee_job_id ON public.job_posting_fee (job_id);

CREATE INDEX idx_job_posting_fee_company_status ON public.job_posting_fee (company_id, status);

INSERT INTO public.job_posting_package (package_id, code, name, description, price, duration_days, is_active, created_at, updated_at)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'FREE', 'Gói Miễn Phí (Trải nghiệm)', 'Đăng 1 tin tuyển dụng hiển thị 30 ngày, tối đa 1 tin mở đồng thời, chu kỳ 2 tháng.', 0, 30, true, now(), now()),
  ('a0000001-0000-0000-0000-000000000002', 'STANDARD', 'Gói Tiêu Chuẩn 30 Ngày', 'Đăng tin công khai 30 ngày, ứng viên nộp hồ sơ không giới hạn, chấm điểm ứng viên bằng AI.', 1500000, 30, true, now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261010000000_AddJobPostingPackagesAndFees', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.candidate ADD current_job_title character varying(150);

ALTER TABLE public.candidate ADD current_level character varying(50);

ALTER TABLE public.candidate ADD target_role character varying(150);

ALTER TABLE public.candidate ADD expected_salary_min numeric(18,2);

ALTER TABLE public.candidate ADD expected_salary_max numeric(18,2);

ALTER TABLE public.candidate ADD expected_salary_currency character varying(10) DEFAULT ('VND'::character varying);

ALTER TABLE public.candidate ADD available_from date;

ALTER TABLE public.candidate ADD preferred_locations character varying(255);

ALTER TABLE public.candidate ADD preferred_work_modes character varying(100);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261012170000_AddCandidateCareerFields', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD application_deadline timestamp with time zone;

CREATE INDEX idx_job_active_deadline ON public.job (status, application_deadline) WHERE ((status)::text = 'ACTIVE'::text);

CREATE TABLE public.candidate_saved_job (
    candidate_saved_job_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    candidate_id uuid NOT NULL,
    job_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT candidate_saved_job_pkey PRIMARY KEY (candidate_saved_job_id),
    CONSTRAINT candidate_saved_job_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE CASCADE,
    CONSTRAINT candidate_saved_job_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_candidate_saved_job ON public.candidate_saved_job (candidate_id, job_id);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261013020000_AddCandidateSavedJobsAndApplicationDeadline', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job_posting_package ADD max_applications integer DEFAULT 50;

ALTER TABLE public.job ADD max_applications integer;

UPDATE public.job_posting_package
SET max_applications = 50
WHERE max_applications IS NULL;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261013210000_AddJobMaxApplicationsAndPendingPayment', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE public.sourcing_delivery (
    delivery_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    job_id uuid NOT NULL,
    application_id uuid NOT NULL,
    status character varying(30) NOT NULL,
    delivered_at timestamp with time zone NOT NULL,
    delivered_by uuid NOT NULL,
    review_due_at timestamp with time zone NOT NULL,
    decided_at timestamp with time zone,
    decided_by uuid,
    reject_reason_code character varying(50),
    reject_note character varying(2000),
    replaced_by_delivery_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT sourcing_delivery_pkey PRIMARY KEY (delivery_id),
    CONSTRAINT ck_sourcing_delivery_reject_reason CHECK (reject_reason_code IS NULL OR reject_reason_code IN ('DUPLICATE_ALREADY_OWNED','FALSE_INFORMATION','UNREACHABLE','WRONG_JOB','OTHER')),
    CONSTRAINT ck_sourcing_delivery_review_due CHECK (review_due_at > delivered_at),
    CONSTRAINT ck_sourcing_delivery_status CHECK (status IN ('DELIVERED','ACCEPTED','REJECTED','AUTO_ACCEPTED','REPLACED')),
    CONSTRAINT sourcing_delivery_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application (application_id) ON DELETE RESTRICT,
    CONSTRAINT sourcing_delivery_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.sourcing_delivery IS 'MF-03 CV_SOURCING: a qualified CV handed to the Client. Only ACCEPTED and AUTO_ACCEPTED are billed (MF-05).';

CREATE INDEX idx_sourcing_delivery_job_status ON public.sourcing_delivery (job_id, status);

CREATE INDEX idx_sourcing_delivery_status_review_due ON public.sourcing_delivery (status, review_due_at);

CREATE UNIQUE INDEX uq_sourcing_delivery_application_active ON public.sourcing_delivery (application_id) WHERE status <> 'REPLACED';

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261014081920_AddSourcingDelivery', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD agreed_at timestamp with time zone;

ALTER TABLE public.job ADD agreed_by uuid;

ALTER TABLE public.job ADD agreement_note text;

ALTER TABLE public.job ADD agreement_reference character varying(500);

ALTER TABLE public.job ADD deposit_percent numeric(5,2);

ALTER TABLE public.job ADD proposed_fee_multiplier numeric(5,2);

ALTER TABLE public.job ADD proposed_fee_note character varying(1000);

ALTER TABLE public.job ADD proposed_payment_due_days integer;

ALTER TABLE public.job ADD proposed_price_per_cv numeric(18,2);

ALTER TABLE public.job ADD proposed_warranty_days integer;

ALTER TABLE public.job ADD review_days integer;

CREATE INDEX "IX_job_agreed_by" ON public.job (agreed_by);

ALTER TABLE public.job ADD CONSTRAINT job_agreed_by_fkey FOREIGN KEY (agreed_by) REFERENCES public.app_user (user_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261014140720_AddJobProposedAndAgreedCommercialTerms', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.submission DROP CONSTRAINT submission_status_check;

ALTER TABLE public.submission ADD CONSTRAINT submission_status_check CHECK (status IN ('RECEIVED','PENDING_CONSENT','ACCEPTED','BLOCKED_DUPLICATE','BLOCKED_CLIENT_OWNED','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED'));

CREATE INDEX idx_application_candidate_applied_at ON public.application (candidate_id, applied_at DESC);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261014140938_AddMf02ClientOwnership', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD template_id uuid;

CREATE TABLE public.job_template (
    template_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(80) NOT NULL,
    name character varying(200) NOT NULL,
    industry character varying(80) NOT NULL,
    level character varying(40),
    keywords text,
    summary character varying(500),
    title character varying(255) NOT NULL,
    description text NOT NULL,
    benefits text,
    employment_type character varying(50),
    min_experience_years integer,
    max_experience_years integer,
    search_text text NOT NULL,
    is_active boolean NOT NULL DEFAULT TRUE,
    usage_count integer NOT NULL DEFAULT 0,
    concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid()),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT job_template_pkey PRIMARY KEY (template_id),
    CONSTRAINT ck_job_template_experience CHECK (min_experience_years IS NULL OR max_experience_years IS NULL OR min_experience_years <= max_experience_years),
    CONSTRAINT ck_job_template_usage CHECK (usage_count >= 0)
);
COMMENT ON TABLE public.job_template IS 'MF-01: shared JD templates a Client can start a job from. Managed by Internal HR / Admin.';

CREATE TABLE public.job_template_requirement (
    template_requirement_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    template_id uuid NOT NULL,
    requirement_type character varying(20) NOT NULL,
    category character varying(120),
    content character varying(4000) NOT NULL,
    display_order integer NOT NULL,
    CONSTRAINT job_template_requirement_pkey PRIMARY KEY (template_requirement_id),
    CONSTRAINT ck_job_template_requirement_type CHECK (requirement_type IN ('MUST_HAVE','SHOULD_HAVE')),
    CONSTRAINT job_template_requirement_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.job_template (template_id) ON DELETE CASCADE
);

CREATE INDEX idx_job_template_id ON public.job (template_id);

CREATE INDEX idx_job_template_active_industry ON public.job_template (is_active, industry);

CREATE UNIQUE INDEX uq_job_template_code ON public.job_template (code);

CREATE INDEX idx_job_template_requirement_order ON public.job_template_requirement (template_id, display_order);

ALTER TABLE public.job ADD CONSTRAINT job_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.job_template (template_id) ON DELETE SET NULL;

INSERT INTO public.permission (code, resource, action, description, is_active, created_at, updated_at)
VALUES ('job_template.manage', 'job_template', 'manage', 'Manage the shared JD template library', true, now(), now())
ON CONFLICT (code) DO UPDATE
SET resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.role r
JOIN public.permission p ON p.code = 'job_template.manage'
WHERE r.code IN ('INTERNAL_HR', 'PLATFORM_ADMIN')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261015040930_AddJobTemplates', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.service_fee DROP CONSTRAINT ck_service_fee_status;

ALTER TABLE public.service_fee ADD CONSTRAINT ck_service_fee_status CHECK (status IN ('PENDING','DUE','PAID','OVERDUE','CANCELLED'));

UPDATE public.commission c
SET status = 'IN_WARRANTY', updated_at = now()
FROM public.warranty w
WHERE w.placement_id = c.placement_id
  AND w.status = 'ACTIVE'
  AND c.status = 'ON_HOLD';

UPDATE public.commission c
SET status = 'IN_WARRANTY', updated_at = now()
FROM public.placement p
WHERE p.placement_id = c.placement_id
  AND p.status = 'STARTED'
  AND c.status = 'PENDING';

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261015104104_Mf05InWarrantyAndDueStatus', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.submission ADD replacement_slot_id uuid;

ALTER TABLE public.placement ADD replacement_slot_id uuid;

ALTER TABLE public.application ADD replacement_slot_id uuid;

CREATE TABLE public.replacement_slot (
    replacement_slot_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    job_id uuid NOT NULL,
    original_placement_id uuid NOT NULL,
    service_fee_id uuid NOT NULL,
    status character varying(30) NOT NULL,
    fill_window_days integer NOT NULL,
    opened_at timestamp with time zone,
    expires_at timestamp with time zone,
    filled_by_placement_id uuid,
    closed_at timestamp with time zone,
    closed_by uuid,
    cancel_reason character varying(500),
    concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid()),
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT replacement_slot_pkey PRIMARY KEY (replacement_slot_id),
    CONSTRAINT ck_replacement_slot_cancel_reason CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL),
    CONSTRAINT ck_replacement_slot_fill_window CHECK (fill_window_days > 0),
    CONSTRAINT ck_replacement_slot_filled CHECK ((status = 'FILLED') = (filled_by_placement_id IS NOT NULL)),
    CONSTRAINT ck_replacement_slot_status CHECK (status IN ('WAITING_PAYMENT','OPEN','FILLED','CANCELLED','EXPIRED')),
    CONSTRAINT fk_replacement_slot_filled_by_placement FOREIGN KEY (filled_by_placement_id) REFERENCES public.placement (placement_id) ON DELETE RESTRICT,
    CONSTRAINT fk_replacement_slot_job FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT,
    CONSTRAINT fk_replacement_slot_original_placement FOREIGN KEY (original_placement_id) REFERENCES public.placement (placement_id) ON DELETE RESTRICT,
    CONSTRAINT fk_replacement_slot_service_fee FOREIGN KEY (service_fee_id) REFERENCES public.service_fee (service_fee_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.replacement_slot IS 'MF-05 free replacement hire after a HEADHUNT_COD placement leaves during warranty. One per placement and per service fee.';

CREATE INDEX idx_submission_replacement_slot_id ON public.submission (replacement_slot_id);

CREATE UNIQUE INDEX placement_replacement_slot_id_key ON public.placement (replacement_slot_id);

CREATE INDEX idx_application_replacement_slot_id ON public.application (replacement_slot_id);

CREATE INDEX idx_replacement_slot_job_status_opened ON public.replacement_slot (job_id, status, opened_at);

CREATE INDEX idx_replacement_slot_status_expires ON public.replacement_slot (status, expires_at);

CREATE UNIQUE INDEX replacement_slot_filled_by_placement_id_key ON public.replacement_slot (filled_by_placement_id);

CREATE UNIQUE INDEX replacement_slot_original_placement_id_key ON public.replacement_slot (original_placement_id);

CREATE UNIQUE INDEX replacement_slot_service_fee_id_key ON public.replacement_slot (service_fee_id);

ALTER TABLE public.application ADD CONSTRAINT fk_application_replacement_slot FOREIGN KEY (replacement_slot_id) REFERENCES public.replacement_slot (replacement_slot_id) ON DELETE RESTRICT;

ALTER TABLE public.placement ADD CONSTRAINT fk_placement_replacement_slot FOREIGN KEY (replacement_slot_id) REFERENCES public.replacement_slot (replacement_slot_id) ON DELETE RESTRICT;

ALTER TABLE public.submission ADD CONSTRAINT fk_submission_replacement_slot FOREIGN KEY (replacement_slot_id) REFERENCES public.replacement_slot (replacement_slot_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261015150310_Mf05ReplacementSlot', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.role_permission ADD grant_source character varying(40) NOT NULL DEFAULT 'SYSTEM_MIGRATION';

ALTER TABLE public.role_permission ADD granted_by uuid;

ALTER TABLE public.role ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.permission ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.permission ADD is_delegable boolean NOT NULL DEFAULT TRUE;

ALTER TABLE public.app_user ADD authorization_concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

INSERT INTO public.role (role_id, code, name, description, is_system, is_active, created_at, updated_at, concurrency_token)
VALUES
    (gen_random_uuid(), 'CANDIDATE', 'Candidate', 'Ứng viên tìm việc', true, true, now(), now(), gen_random_uuid()),
    (gen_random_uuid(), 'AFFILIATE_RECRUITER', 'Affiliate Recruiter', 'Đối tác tuyển dụng / Cộng tác viên', true, true, now(), now(), gen_random_uuid()),
    (gen_random_uuid(), 'CLIENT_COMPANY_USER', 'Client Company User', 'Người đại diện doanh nghiệp tuyển dụng', true, true, now(), now(), gen_random_uuid()),
    (gen_random_uuid(), 'INTERNAL_HR', 'Internal HR', 'Nhân sự nội bộ HRConnect', true, true, now(), now(), gen_random_uuid()),
    (gen_random_uuid(), 'PLATFORM_ADMIN', 'Platform Admin', 'Quản trị viên toàn hệ thống', true, true, now(), now(), gen_random_uuid())
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = true,
    updated_at = now();

INSERT INTO public.permission (code, resource, action, description)
VALUES
    ('job.view', 'job', 'view', 'View published jobs'),
    ('notification.view_own', 'notification', 'view_own', 'View own notifications'),
    ('candidate.profile.view_own', 'candidate_profile', 'view_own', 'View own candidate profile'),
    ('candidate.profile.update_own', 'candidate_profile', 'update_own', 'Update own candidate profile'),
    ('candidate.identity.manage_own', 'candidate_identity', 'manage_own', 'Manage own verified email identities'),
    ('candidate.identity.review', 'candidate_identity', 'review', 'Review Candidate identity claims'),
    ('candidate_duplicate.view', 'candidate_duplicate', 'view', 'View Candidate duplicate review cases'),
    ('candidate_duplicate.resolve', 'candidate_duplicate', 'resolve', 'Resolve and merge Candidate duplicate cases'),
    ('cv.create', 'candidate_cv', 'create', 'Create own CV'),
    ('cv.view_own', 'candidate_cv', 'view_own', 'View own CV'),
    ('cv.update_own', 'candidate_cv', 'update_own', 'Update own CV'),
    ('cv.delete_own', 'candidate_cv', 'delete_own', 'Delete own CV'),
    ('cv.affiliate_reuse.manage_own', 'candidate_cv', 'affiliate_reuse_manage_own', 'Manage whether an Affiliate may reuse an uploaded CV for new consent requests'),
    ('application.create', 'application', 'create', 'Apply to a job'),
    ('application.view_own', 'application', 'view_own', 'View own job applications'),
    ('application.withdraw_own', 'application', 'withdraw_own', 'Withdraw own job application'),
    ('interview.view_own', 'interview', 'view_own', 'View own interview schedule'),
    ('offer.view_own', 'offer', 'view_own', 'View own offers'),
    ('offer.respond', 'offer', 'respond', 'Accept or decline own offer'),
    ('affiliate.apply', 'affiliate_application', 'create', 'Apply to become an affiliate recruiter'),
    ('affiliate.profile.view_own', 'affiliate_profile', 'view_own', 'View own affiliate profile'),
    ('affiliate.profile.update_own', 'affiliate_profile', 'update_own', 'Update own affiliate profile'),
    ('submission.create', 'submission', 'create', 'Submit a candidate and CV for a job'),
    ('submission.view_own', 'submission', 'view_own', 'View own submissions'),
    ('referral.progress.view_own', 'affiliate_referral', 'view_own', 'View high-level progress of own referrals'),
    ('submission.consent.resend_own', 'submission_consent', 'resend_own', 'Resend consent request for own submission'),
    ('candidate_library.view_own', 'affiliate_candidate_library', 'view_own', 'View candidates and CV metadata in own affiliate library'),
    ('candidate_library.download_cv', 'affiliate_candidate_library', 'download_cv', 'Download CV from own affiliate candidate library'),
    ('attribution.view_own', 'attribution', 'view_own', 'View own affiliate attribution'),
    ('dispute.create', 'dispute', 'create', 'Raise duplicate or attribution dispute'),
    ('dispute.view_own', 'dispute', 'view_own', 'View own disputes'),
    ('commission.view_own', 'commission', 'view_own', 'View own commissions'),
    ('payout.view_own', 'payout', 'view_own', 'View own payouts'),
    ('affiliate.performance.view_own', 'affiliate_performance', 'view_own', 'View own affiliate performance'),
    ('company.profile.view_own', 'company', 'view_own', 'View own company profile'),
    ('company.profile.update_own', 'company', 'update_own', 'Update own company profile'),
    ('job.create', 'job', 'create', 'Create job posting'),
    ('job.view_own', 'job', 'view_own', 'View own company jobs'),
    ('job.update_own', 'job', 'update_own', 'Update own company jobs'),
    ('application.view_company', 'application', 'view_company', 'View applications for own company jobs'),
    ('candidate.review_company', 'candidate', 'review_company', 'Review candidates for own company jobs'),
    ('interview.create', 'interview', 'create', 'Create interviews'),
    ('interview.update', 'interview', 'update', 'Update interviews'),
    ('interview.view_company', 'interview', 'view_company', 'View interviews for own company jobs'),
    ('offer.create', 'offer', 'create', 'Create job offers'),
    ('offer.update', 'offer', 'update', 'Update job offers'),
    ('offer.view_company', 'offer', 'view_company', 'View offers for own company jobs'),
    ('interview.record_result', 'interview', 'record_result', 'Record interview result'),
    ('application.decide_backup', 'application', 'decide_backup', 'Decide backup candidate selection'),
    ('offer.send', 'offer', 'send', 'Send offer to candidate'),
    ('offer.withdraw', 'offer', 'withdraw', 'Withdraw job offer'),
    ('placement.confirm', 'placement', 'confirm', 'Confirm candidate placement and start work'),
    ('application.mark_not_started', 'application', 'mark_not_started', 'Mark placed candidate as not started'),
    ('company.view', 'company', 'view', 'View companies'),
    ('job.review', 'job', 'review', 'Review job postings'),
    ('job.publish', 'job', 'publish', 'Publish approved job postings'),
    ('job_template.manage', 'job_template', 'manage', 'Manage the shared JD template library'),
    ('candidate.view', 'candidate', 'view', 'View candidate information'),
    ('application.view', 'application', 'view', 'View applications'),
    ('application.screen', 'application', 'screen', 'Screen applications'),
    ('application.retry_ai_scoring', 'application', 'retry_ai_scoring', 'Retry failed AI scoring'),
    ('submission.view', 'submission', 'view', 'View submissions'),
    ('attribution.view', 'attribution', 'view', 'View affiliate attribution'),
    ('interview.manage', 'interview', 'manage', 'Manage interviews'),
    ('offer.manage', 'offer', 'manage', 'Manage job offers'),
    ('placement.manage', 'placement', 'manage', 'Manage placements'),
    ('probation.manage', 'probation', 'manage', 'Manage probation tracking'),
    ('warranty.manage', 'warranty', 'manage', 'Manage warranty tracking'),
    ('commission.view', 'commission', 'view', 'View commission records'),
    ('payout.view', 'payout', 'view', 'View payout records'),
    ('user.view', 'app_user', 'view', 'View platform users'),
    ('user.manage', 'app_user', 'manage', 'Manage platform users'),
    ('role.view', 'role', 'view', 'View system roles'),
    ('role.manage', 'role', 'manage', 'Manage system roles'),
    ('permission.view', 'permission', 'view', 'View system permissions'),
    ('permission.manage', 'permission', 'manage', 'Manage role permissions'),
    ('company.verify', 'company_verification_request', 'verify', 'Review and verify client companies'),
    ('affiliate.verify', 'affiliate_application', 'verify', 'Review and approve affiliate applications'),
    ('dispute.view', 'dispute', 'view', 'View disputes'),
    ('dispute.resolve', 'dispute', 'resolve', 'Resolve duplicate and attribution disputes'),
    ('commission.manage', 'commission', 'manage', 'Manage commissions'),
    ('payout.manage', 'payout', 'manage', 'Manage payouts'),
    ('system_config.view', 'system_config', 'view', 'View system configuration'),
    ('system_config.manage', 'system_config', 'manage', 'Manage system configuration'),
    ('report.view', 'report', 'view', 'View reports and dashboards'),
    ('audit.view', 'audit_log', 'view', 'View audit logs'),
    ('contact_request.manage', 'contact_request', 'manage', 'Follow up public contact requests')
ON CONFLICT (code) DO UPDATE
SET resource = EXCLUDED.resource, action = EXCLUDED.action, description = EXCLUDED.description, is_active = true, updated_at = now();

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.role r
JOIN public.permission p ON p.code IN (
    'job.view', 'notification.view_own', 'candidate.profile.view_own', 'candidate.profile.update_own', 'candidate.identity.manage_own',
    'cv.create', 'cv.view_own', 'cv.update_own', 'cv.delete_own', 'cv.affiliate_reuse.manage_own', 'application.create', 'application.view_own', 'application.withdraw_own',
    'interview.view_own', 'offer.view_own', 'offer.respond', 'affiliate.apply'
)
WHERE r.code = 'CANDIDATE'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.role r
JOIN public.permission p ON p.code IN (
    'job.view', 'notification.view_own', 'affiliate.profile.view_own', 'affiliate.profile.update_own',
    'submission.create', 'submission.view_own', 'referral.progress.view_own', 'submission.consent.resend_own',
    'candidate_library.view_own', 'candidate_library.download_cv',
    'attribution.view_own', 'dispute.create', 'dispute.view_own',
    'commission.view_own', 'payout.view_own', 'affiliate.performance.view_own'
)
WHERE r.code = 'AFFILIATE_RECRUITER'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.role r
JOIN public.permission p ON p.code IN (
    'notification.view_own', 'company.profile.view_own', 'company.profile.update_own',
    'job.create', 'job.view_own', 'job.update_own', 'application.view_company', 'candidate.review_company',
    'interview.create', 'interview.update', 'interview.view_company', 'offer.create', 'offer.update', 'offer.view_company',
    'interview.record_result', 'application.decide_backup', 'offer.send', 'offer.withdraw', 'placement.confirm', 'application.mark_not_started'
)
WHERE r.code = 'CLIENT_COMPANY_USER'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.role r
JOIN public.permission p ON p.code IN (
    'job.view', 'notification.view_own', 'company.view', 'job.review', 'job.publish', 'candidate.view',
    'application.view', 'application.screen', 'application.retry_ai_scoring', 'submission.view', 'attribution.view',
    'probation.manage', 'warranty.manage', 'job_template.manage',
    'commission.view', 'payout.view', 'contact_request.manage'
)
WHERE r.code = 'INTERNAL_HR'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.role r
JOIN public.permission p ON p.code IN (
    'job.view', 'job.review', 'job.publish', 'job_template.manage', 'notification.view_own', 'user.view', 'user.manage', 'role.view', 'role.manage',
    'permission.view', 'permission.manage', 'company.verify', 'affiliate.verify', 'candidate.identity.review',
    'candidate_duplicate.view', 'candidate_duplicate.resolve',
    'dispute.view', 'dispute.resolve', 'commission.manage', 'payout.manage',
    'system_config.view', 'system_config.manage', 'report.view', 'audit.view', 'application.retry_ai_scoring',
    'interview.record_result', 'application.decide_backup', 'offer.send', 'offer.withdraw', 'placement.confirm', 'application.mark_not_started',
    'contact_request.manage'
)
WHERE r.code = 'PLATFORM_ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

UPDATE public.user_role
SET status = CASE WHEN upper(trim(status)) = 'REVOKED' THEN 'REVOKED' ELSE 'ACTIVE' END;

UPDATE public.user_role
SET revoked_at = NULL,
    revoked_by = NULL,
    revoke_reason = NULL
WHERE status = 'ACTIVE';

UPDATE public.user_role
SET revoked_at = COALESCE(revoked_at, now()),
    revoke_reason = COALESCE(NULLIF(trim(revoke_reason), ''), 'Migrated legacy revoked assignment')
WHERE status = 'REVOKED';

UPDATE public.permission
SET is_delegable = false,
    concurrency_token = gen_random_uuid(),
    updated_at = now()
WHERE code IN ('role.manage', 'permission.manage', 'user.manage', 'system_config.manage', 'audit.view');

ALTER TABLE public.user_role ADD CONSTRAINT ck_user_role_lifecycle CHECK ((status = 'ACTIVE' AND revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL AND length(trim(revoke_reason)) > 0));

ALTER TABLE public.user_role ADD CONSTRAINT ck_user_role_status CHECK (status IN ('ACTIVE','REVOKED'));

CREATE INDEX "IX_role_permission_granted_by" ON public.role_permission (granted_by);

ALTER TABLE public.role_permission ADD CONSTRAINT role_permission_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.app_user (user_id) ON DELETE SET NULL;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261016041349_AddProductionRbacManagement', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.offer ADD salary_basis character varying(10);

ALTER TABLE public.offer ADD salary_period character varying(10);

UPDATE public.offer
SET salary_basis = 'GROSS', salary_period = 'MONTHLY'
WHERE salary IS NOT NULL;

ALTER TABLE public.offer ADD CONSTRAINT ck_offer_salary_basis CHECK (salary_basis IS NULL OR salary_basis IN ('GROSS','NET'));

ALTER TABLE public.offer ADD CONSTRAINT ck_offer_salary_period CHECK (salary_period IS NULL OR salary_period IN ('MONTHLY','ANNUAL'));

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261016070824_AddOfferSalarySemantics', '8.0.11');

COMMIT;

START TRANSACTION;

DROP TRIGGER IF EXISTS trg_job_visibility_matrix ON public.job;
DROP FUNCTION IF EXISTS public.enforce_job_visibility_matrix();
DROP INDEX IF EXISTS public.idx_job_visibility_status;
ALTER TABLE public.job DROP CONSTRAINT IF EXISTS ck_job_visibility;
ALTER TABLE public.job DROP COLUMN IF EXISTS visibility;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261016134228_DropJobVisibility', '8.0.11');

COMMIT;

START TRANSACTION;

COMMENT ON TABLE public.service_fee IS 'MF-05 service fee the Client owes: one HEADHUNT_COD placement (PLACEMENT) or a CV_SOURCING job''s DEPOSIT, SETTLEMENT or CREDIT. Paid outside the system; Platform Admin records payment.';

ALTER TABLE public.service_fee ALTER COLUMN placement_id DROP NOT NULL;

ALTER TABLE public.service_fee ADD job_id uuid;

ALTER TABLE public.service_fee ADD kind character varying(20) NOT NULL DEFAULT ('PLACEMENT'::character varying);

ALTER TABLE public.commission ALTER COLUMN placement_id DROP NOT NULL;

ALTER TABLE public.commission ALTER COLUMN commission_rule_id DROP NOT NULL;

ALTER TABLE public.commission ADD sourcing_delivery_id uuid;

CREATE UNIQUE INDEX uq_service_fee_job_closing ON public.service_fee (job_id) WHERE kind IN ('SETTLEMENT','CREDIT');

CREATE UNIQUE INDEX uq_service_fee_job_deposit ON public.service_fee (job_id) WHERE kind = 'DEPOSIT';

ALTER TABLE public.service_fee ADD CONSTRAINT ck_service_fee_kind CHECK (kind IN ('PLACEMENT','DEPOSIT','SETTLEMENT','CREDIT'));

ALTER TABLE public.service_fee ADD CONSTRAINT ck_service_fee_source CHECK ((kind = 'PLACEMENT' AND placement_id IS NOT NULL) OR (kind <> 'PLACEMENT' AND placement_id IS NULL AND job_id IS NOT NULL));

CREATE UNIQUE INDEX uq_commission_sourcing_delivery ON public.commission (sourcing_delivery_id) WHERE sourcing_delivery_id IS NOT NULL;

ALTER TABLE public.commission ADD CONSTRAINT ck_commission_source CHECK ((placement_id IS NULL) <> (sourcing_delivery_id IS NULL));

ALTER TABLE public.commission ADD CONSTRAINT commission_sourcing_delivery_id_fkey FOREIGN KEY (sourcing_delivery_id) REFERENCES public.sourcing_delivery (delivery_id) ON DELETE RESTRICT;

ALTER TABLE public.service_fee ADD CONSTRAINT service_fee_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261017150325_AddSourcingFinance', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.app_user ADD avatar_object_key character varying(1024);

ALTER TABLE public.app_user ADD avatar_updated_at timestamp with time zone;

UPDATE public.app_user
SET avatar_object_key = avatar_url,
    avatar_updated_at = COALESCE(updated_at, now()),
    avatar_url = NULL
WHERE avatar_url LIKE 'avatars/%';

CREATE TABLE public.storage_cleanup_job (
    storage_cleanup_job_id uuid NOT NULL,
    user_id uuid,
    object_key character varying(1024) NOT NULL,
    reason character varying(40) NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'PENDING',
    attempt_count integer NOT NULL DEFAULT 0,
    next_attempt_at timestamp with time zone,
    processing_started_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_error character varying(2000),
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT storage_cleanup_job_pkey PRIMARY KEY (storage_cleanup_job_id),
    CONSTRAINT ck_storage_cleanup_job_avatar_namespace CHECK (object_key LIKE 'avatars/%'),
    CONSTRAINT ck_storage_cleanup_job_status CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','DEAD')),
    CONSTRAINT storage_cleanup_job_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_storage_cleanup_job_due ON public.storage_cleanup_job (status, next_attempt_at);

CREATE INDEX "IX_storage_cleanup_job_user_id" ON public.storage_cleanup_job (user_id);

CREATE UNIQUE INDEX uq_storage_cleanup_job_active_key ON public.storage_cleanup_job (object_key) WHERE status IN ('PENDING','PROCESSING','FAILED');

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261019040709_ProductionAvatarStorage', '8.0.11');

COMMIT;

START TRANSACTION;

DROP INDEX public."IX_dispute_submission_id";

CREATE INDEX idx_dispute_status_created ON public.dispute (status, created_at);

CREATE UNIQUE INDEX uq_dispute_submission_open ON public.dispute (submission_id) WHERE status IN ('OPEN','UNDER_REVIEW');

ALTER TABLE public.dispute ADD CONSTRAINT ck_dispute_status CHECK (status IN ('OPEN','UNDER_REVIEW','UPHELD','REJECTED','WITHDRAWN'));

ALTER TABLE public.dispute ADD CONSTRAINT ck_dispute_type CHECK (dispute_type IN ('DUPLICATE_SUBMISSION','ATTRIBUTION'));

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261019123714_AddDisputeConstraints', '8.0.11');

COMMIT;

START TRANSACTION;

CREATE TABLE public.contact_request (
    contact_request_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    full_name character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(30),
    company_name character varying(255),
    service_interest character varying(30) NOT NULL,
    message character varying(2000) NOT NULL,
    consent_accepted boolean NOT NULL,
    status character varying(20) NOT NULL DEFAULT ('NEW'::character varying),
    handled_by uuid,
    note character varying(2000),
    source_ip_hash character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT contact_request_pkey PRIMARY KEY (contact_request_id),
    CONSTRAINT ck_contact_request_consent CHECK (consent_accepted),
    CONSTRAINT ck_contact_request_service CHECK (service_interest IN ('HEADHUNT_COD','CV_SOURCING','CV_APPLICATION','OTHER')),
    CONSTRAINT ck_contact_request_status CHECK (status IN ('NEW','CONTACTED','CLOSED'))
);
COMMENT ON TABLE public.contact_request IS 'BE-04 A: public contact form. Stored only with consent (Decree 13/2023).';

CREATE INDEX idx_contact_request_ip_created ON public.contact_request (source_ip_hash, created_at);

CREATE INDEX idx_contact_request_status_created ON public.contact_request (status, created_at);

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261019130539_AddContactRequest', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.company ADD company_size_id uuid;

ALTER TABLE public.company ADD featured_order integer;

ALTER TABLE public.company ADD industry_id uuid;

ALTER TABLE public.company ADD is_featured boolean NOT NULL DEFAULT FALSE;

CREATE TABLE public.company_size (
    company_size_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(30) NOT NULL,
    label character varying(100) NOT NULL,
    min_employees integer NOT NULL,
    max_employees integer,
    sort_order integer NOT NULL,
    is_active boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT company_size_pkey PRIMARY KEY (company_size_id)
);
COMMENT ON TABLE public.company_size IS 'BE-02 A: company size bands, seeded from Seed/Data/company_size.csv.';

CREATE TABLE public.industry (
    industry_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    code character varying(100) NOT NULL,
    name_en character varying(200) NOT NULL,
    name_vi character varying(200),
    level smallint NOT NULL,
    parent_id uuid,
    sort_order integer NOT NULL,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT industry_pkey PRIMARY KEY (industry_id),
    CONSTRAINT ck_industry_level CHECK (level BETWEEN 1 AND 3),
    CONSTRAINT industry_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.industry (industry_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.industry IS 'BE-02 A: industry taxonomy L1/L2/L3, seeded from Seed/Data/industry.csv, edited by Platform Admin.';

CREATE INDEX idx_company_featured ON public.company (is_featured, featured_order);

CREATE INDEX idx_company_industry ON public.company (industry_id);

CREATE INDEX "IX_company_company_size_id" ON public.company (company_size_id);

CREATE UNIQUE INDEX company_size_code_key ON public.company_size (code);

CREATE INDEX idx_industry_parent ON public.industry (parent_id, is_active, sort_order);

CREATE UNIQUE INDEX industry_code_key ON public.industry (code);

ALTER TABLE public.company ADD CONSTRAINT company_company_size_id_fkey FOREIGN KEY (company_size_id) REFERENCES public.company_size (company_size_id) ON DELETE RESTRICT;

ALTER TABLE public.company ADD CONSTRAINT company_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES public.industry (industry_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261019135330_AddIndustryTaxonomyAndCompanyDirectory', '8.0.11');

COMMIT;

START TRANSACTION;

DROP INDEX public.uq_submission_one_pending_consent;

ALTER TABLE public.submission DROP CONSTRAINT submission_status_check;

ALTER INDEX public."IX_candidate_merged_into_candidate_id" RENAME TO idx_candidate_merged_into;

ALTER TABLE public.dispute ADD candidate_duplicate_case_id uuid;

ALTER TABLE public.dispute ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.candidate_cv ADD content_sha256 character varying(64);

ALTER TABLE public.candidate_cv ADD fingerprint_version character varying(30);

ALTER TABLE public.candidate_cv ADD text_fingerprint character varying(128);

ALTER TABLE public.candidate ADD merge_concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

ALTER TABLE public.attribution ADD concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid());

CREATE TABLE public.candidate_duplicate_case (
    duplicate_case_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    candidate_a_id uuid NOT NULL,
    candidate_b_id uuid NOT NULL,
    submission_id uuid,
    job_id uuid,
    risk_level character varying(20) NOT NULL,
    status character varying(30) NOT NULL,
    resolution character varying(30),
    resolution_reason character varying(1000),
    canonical_candidate_id uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid()),
    idempotency_key character varying(160) NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    updated_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT candidate_duplicate_case_pkey PRIMARY KEY (duplicate_case_id),
    CONSTRAINT ck_candidate_duplicate_case_order CHECK (candidate_a_id < candidate_b_id),
    CONSTRAINT ck_candidate_duplicate_case_resolution CHECK (resolution IS NULL OR resolution IN ('MERGED','NOT_DUPLICATE','NO_ACTION','FINANCE_BLOCKED')),
    CONSTRAINT ck_candidate_duplicate_case_risk CHECK (risk_level IN ('REVIEW','HIGH')),
    CONSTRAINT ck_candidate_duplicate_case_status CHECK (status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','MERGED','DISMISSED','BLOCKED_FINANCE')),
    CONSTRAINT fk_candidate_duplicate_case_candidate_a FOREIGN KEY (candidate_a_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_duplicate_case_candidate_b FOREIGN KEY (candidate_b_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_duplicate_case_canonical FOREIGN KEY (canonical_candidate_id) REFERENCES public.candidate (candidate_id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_duplicate_case_job FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_duplicate_case_reviewer FOREIGN KEY (reviewed_by) REFERENCES public.app_user (user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_duplicate_case_submission FOREIGN KEY (submission_id) REFERENCES public.submission (submission_id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.candidate_duplicate_case IS 'Reviewable duplicate identity case. Similarity alone never merges Candidates.';

CREATE TABLE public.submission_identity_snapshot (
    submission_id uuid NOT NULL,
    normalized_name_hash character varying(128),
    email_hmac character varying(128),
    phone_hmac character varying(128),
    hmac_key_version character varying(30),
    cv_content_sha256 character varying(64),
    cv_text_fingerprint character varying(128),
    fingerprint_version character varying(30),
    asserted_contact_source character varying(30) NOT NULL,
    verification_level character varying(30) NOT NULL,
    captured_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT submission_identity_snapshot_pkey PRIMARY KEY (submission_id),
    CONSTRAINT ck_submission_identity_snapshot_contact_source CHECK (asserted_contact_source IN ('AFFILIATE','CANDIDATE','SYSTEM')),
    CONSTRAINT ck_submission_identity_snapshot_verification CHECK (verification_level IN ('ASSERTED','EMAIL_VERIFIED','PHONE_VERIFIED','CANDIDATE_CONFIRMED')),
    CONSTRAINT fk_submission_identity_snapshot_submission FOREIGN KEY (submission_id) REFERENCES public.submission (submission_id) ON DELETE CASCADE
);
COMMENT ON TABLE public.submission_identity_snapshot IS 'Immutable privacy-minimized identity evidence captured at submission intake.';

CREATE TABLE public.candidate_duplicate_signal (
    duplicate_signal_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    duplicate_case_id uuid NOT NULL,
    reason_code character varying(80) NOT NULL,
    detector_version character varying(30) NOT NULL,
    score numeric(5,4) NOT NULL,
    key_version character varying(30),
    evidence jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT candidate_duplicate_signal_pkey PRIMARY KEY (duplicate_signal_id),
    CONSTRAINT ck_candidate_duplicate_signal_score CHECK (score >= 0 AND score <= 1),
    CONSTRAINT fk_candidate_duplicate_signal_case FOREIGN KEY (duplicate_case_id) REFERENCES public.candidate_duplicate_case (duplicate_case_id) ON DELETE CASCADE
);
COMMENT ON TABLE public.candidate_duplicate_signal IS 'Minimized explainable evidence; raw PII and CV text are prohibited.';

CREATE UNIQUE INDEX uq_submission_one_pending_consent ON public.submission (job_id, candidate_id, submitted_by) WHERE status IN ('PENDING_CONSENT','PENDING_IDENTITY_REVIEW');

ALTER TABLE public.submission ADD CONSTRAINT submission_status_check CHECK (status IN ('RECEIVED','PENDING_CONSENT','PENDING_IDENTITY_REVIEW','ACCEPTED','BLOCKED_DUPLICATE','BLOCKED_CLIENT_OWNED','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED'));

CREATE INDEX idx_dispute_candidate_duplicate_case ON public.dispute (candidate_duplicate_case_id) WHERE candidate_duplicate_case_id IS NOT NULL;

CREATE INDEX idx_candidate_cv_content_sha256 ON public.candidate_cv (content_sha256) WHERE content_sha256 IS NOT NULL;

CREATE INDEX idx_candidate_duplicate_case_canonical ON public.candidate_duplicate_case (canonical_candidate_id) WHERE canonical_candidate_id IS NOT NULL;

CREATE INDEX idx_candidate_duplicate_case_status_created ON public.candidate_duplicate_case (status, created_at);

CREATE INDEX "IX_candidate_duplicate_case_candidate_b_id" ON public.candidate_duplicate_case (candidate_b_id);

CREATE INDEX "IX_candidate_duplicate_case_job_id" ON public.candidate_duplicate_case (job_id);

CREATE INDEX "IX_candidate_duplicate_case_reviewed_by" ON public.candidate_duplicate_case (reviewed_by);

CREATE INDEX "IX_candidate_duplicate_case_submission_id" ON public.candidate_duplicate_case (submission_id);

CREATE UNIQUE INDEX uq_candidate_duplicate_case_active_global ON public.candidate_duplicate_case (candidate_a_id, candidate_b_id) WHERE job_id IS NULL AND status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','BLOCKED_FINANCE');

CREATE UNIQUE INDEX uq_candidate_duplicate_case_active_job ON public.candidate_duplicate_case (candidate_a_id, candidate_b_id, job_id) WHERE job_id IS NOT NULL AND status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','BLOCKED_FINANCE');

CREATE UNIQUE INDEX uq_candidate_duplicate_case_idempotency ON public.candidate_duplicate_case (idempotency_key);

CREATE UNIQUE INDEX uq_candidate_duplicate_signal_reason ON public.candidate_duplicate_signal (duplicate_case_id, reason_code);

CREATE INDEX idx_submission_identity_cv_sha256 ON public.submission_identity_snapshot (cv_content_sha256) WHERE cv_content_sha256 IS NOT NULL;

CREATE INDEX idx_submission_identity_email_hmac ON public.submission_identity_snapshot (email_hmac, hmac_key_version) WHERE email_hmac IS NOT NULL;

CREATE INDEX idx_submission_identity_phone_hmac ON public.submission_identity_snapshot (phone_hmac, hmac_key_version) WHERE phone_hmac IS NOT NULL;

ALTER TABLE public.dispute ADD CONSTRAINT fk_dispute_candidate_duplicate_case FOREIGN KEY (candidate_duplicate_case_id) REFERENCES public.candidate_duplicate_case (duplicate_case_id) ON DELETE RESTRICT;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261019145220_AddCandidateIdentityDedup', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.candidate_duplicate_case ADD resolution_idempotency_key character varying(160);

CREATE UNIQUE INDEX uq_candidate_duplicate_case_resolution_idempotency ON public.candidate_duplicate_case (resolution_idempotency_key) WHERE resolution_idempotency_key IS NOT NULL;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261020072816_AddCandidateDuplicateResolutionIdempotency', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.dispute ADD resolution_idempotency_key character varying(100);

CREATE UNIQUE INDEX uq_dispute_resolution_idempotency ON public.dispute (resolution_idempotency_key) WHERE resolution_idempotency_key IS NOT NULL;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261020082149_HardenDisputeResolution', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.interview ADD candidate_attendance_status character varying(20);

ALTER TABLE public.interview ADD candidate_responded_at timestamp with time zone;

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261022113121_AddCandidateInterviewAttendanceConfirmation', '8.0.11');

COMMIT;

START TRANSACTION;

ALTER TABLE public.job ADD current_service_agreement_id uuid;

CREATE TABLE public.service_agreement (
    service_agreement_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    job_id uuid NOT NULL,
    company_id uuid NOT NULL,
    version integer NOT NULL,
    service_type_code character varying(50) NOT NULL,
    status character varying(30) NOT NULL,
    concurrency_token uuid NOT NULL DEFAULT (gen_random_uuid()),
    is_current boolean NOT NULL DEFAULT FALSE,
    fee_multiplier numeric(6,3),
    warranty_days integer,
    payment_due_days integer,
    price_per_qualified_cv numeric(18,2),
    sourcing_target integer,
    review_days integer,
    agreement_note text,
    change_request_reason text,
    company_name_snapshot character varying(255) NOT NULL,
    company_tax_code_snapshot character varying(50),
    company_address_snapshot text,
    hrconnect_legal_entity_snapshot text,
    signer_user_id uuid,
    signer_name_snapshot character varying(255),
    signer_email_snapshot character varying(255),
    signer_role_snapshot character varying(100),
    consent_text_version character varying(50),
    consent_accepted_at timestamp with time zone,
    unsigned_document_storage_key text,
    signed_document_storage_key text,
    document_sha256_hash character varying(128),
    verification_code character varying(64) NOT NULL,
    signer_ip_hash character varying(128),
    signer_user_agent_summary text,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    sent_to_client_at timestamp with time zone,
    responded_at timestamp with time zone,
    signed_at timestamp with time zone,
    voided_at timestamp with time zone,
    voided_by_user_id uuid,
    void_reason text,
    CONSTRAINT service_agreement_pkey PRIMARY KEY (service_agreement_id),
    CONSTRAINT ck_service_agreement_status CHECK (status IN ('DRAFT','SENT_TO_CLIENT','CHANGE_REQUESTED','ACCEPTED','AWAITING_SIGNATURE','SIGNED','VOID','LEGACY_CONFIRMED')),
    CONSTRAINT service_agreement_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company (company_id) ON DELETE RESTRICT,
    CONSTRAINT service_agreement_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT,
    CONSTRAINT service_agreement_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job (job_id) ON DELETE RESTRICT,
    CONSTRAINT service_agreement_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.app_user (user_id) ON DELETE SET NULL,
    CONSTRAINT service_agreement_voided_by_user_id_fkey FOREIGN KEY (voided_by_user_id) REFERENCES public.app_user (user_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.service_agreement IS 'MF-01 Service agreement versions and signing evidence between Client and HR Connect.';

CREATE TABLE public.service_agreement_signature_challenge (
    challenge_id uuid NOT NULL DEFAULT (gen_random_uuid()),
    service_agreement_id uuid NOT NULL,
    signer_user_id uuid NOT NULL,
    signer_email_normalized character varying(255) NOT NULL,
    otp_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 5,
    is_consumed boolean NOT NULL DEFAULT FALSE,
    consumed_at timestamp with time zone,
    is_revoked boolean NOT NULL DEFAULT FALSE,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT (now()),
    CONSTRAINT service_agreement_signature_challenge_pkey PRIMARY KEY (challenge_id),
    CONSTRAINT challenge_service_agreement_id_fkey FOREIGN KEY (service_agreement_id) REFERENCES public.service_agreement (service_agreement_id) ON DELETE CASCADE,
    CONSTRAINT challenge_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.app_user (user_id) ON DELETE RESTRICT
);

CREATE INDEX "IX_job_current_service_agreement_id" ON public.job (current_service_agreement_id);

CREATE INDEX idx_service_agreement_company_status ON public.service_agreement (company_id, status);

CREATE INDEX "IX_service_agreement_created_by_user_id" ON public.service_agreement (created_by_user_id);

CREATE INDEX "IX_service_agreement_signer_user_id" ON public.service_agreement (signer_user_id);

CREATE INDEX "IX_service_agreement_voided_by_user_id" ON public.service_agreement (voided_by_user_id);

CREATE UNIQUE INDEX uq_service_agreement_current_job ON public.service_agreement (job_id, is_current) WHERE is_current = true AND status <> 'VOID';

CREATE UNIQUE INDEX uq_service_agreement_job_version ON public.service_agreement (job_id, version);

CREATE UNIQUE INDEX uq_service_agreement_verification_code ON public.service_agreement (verification_code);

CREATE INDEX idx_challenge_agreement_signer ON public.service_agreement_signature_challenge (service_agreement_id, signer_user_id);

CREATE INDEX "IX_service_agreement_signature_challenge_signer_user_id" ON public.service_agreement_signature_challenge (signer_user_id);

ALTER TABLE public.job ADD CONSTRAINT job_current_service_agreement_id_fkey FOREIGN KEY (current_service_agreement_id) REFERENCES public.service_agreement (service_agreement_id) ON DELETE SET NULL;


                INSERT INTO service_agreement (
                    service_agreement_id,
                    job_id,
                    company_id,
                    version,
                    service_type_code,
                    status,
                    concurrency_token,
                    is_current,
                    fee_multiplier,
                    warranty_days,
                    payment_due_days,
                    price_per_qualified_cv,
                    sourcing_target,
                    review_days,
                    agreement_note,
                    company_name_snapshot,
                    verification_code,
                    created_by_user_id,
                    created_at,
                    signed_at
                )
                SELECT 
                    gen_random_uuid(),
                    j.job_id,
                    j.company_id,
                    1,
                    COALESCE(st.code, 'CV_SOURCING'),
                    'LEGACY_CONFIRMED',
                    gen_random_uuid(),
                    true,
                    j.fee_multiplier,
                    j.warranty_days,
                    j.payment_due_days,
                    j.sourcing_price_per_cv,
                    j.sourcing_target,
                    j.review_days,
                    COALESCE(j.agreement_note, j.agreement_reference),
                    COALESCE(c.company_name, 'Legacy Company'),
                    'LEGACY-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 12)),
                    COALESCE(j.agreed_by, j.created_by),
                    COALESCE(j.agreed_at, j.created_at, now()),
                    j.agreed_at
                FROM job j
                LEFT JOIN service_type st ON j.service_type_id = st.service_type_id
                LEFT JOIN company c ON j.company_id = c.company_id
                WHERE j.agreed_at IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM service_agreement sa WHERE sa.job_id = j.job_id
                  );

                UPDATE job j
                SET current_service_agreement_id = sa.service_agreement_id
                FROM service_agreement sa
                WHERE sa.job_id = j.job_id AND sa.is_current = true
                  AND j.current_service_agreement_id IS NULL;
            

INSERT INTO public."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261022132101_AddServiceAgreement', '8.0.11');

COMMIT;

