-- ============================================================================
-- Seed Demo UV6, UV7, UV8, UV9 (Production / Staging Idempotent Script)
-- - UV6: Đặng Khánh Linh (HEADHUNT_COD, Offer 20M -> fee 30M, Placement CONFIRMED, Fee DUE / unpaid)
-- - UV7: Bùi Gia Huy (CV_SOURCING, no account, Consent CONFIRMED, SourcingDelivery ACCEPTED)
-- - UV8: Hoàng Mỹ Duyên (CV_SOURCING, no account, Consent CONFIRMED, SourcingDelivery DELIVERED / pending)
-- - UV9: Trương Nhật Minh (Candidate account + CV ready for backup replacement apply)
-- ============================================================================

BEGIN;

DO $$
DECLARE
    c_pw_hash CONSTANT text := '$2a$12$H7jePMEfqymUQSOeDAhKeOih5zIVIqagKHAbZ3rs/uE/HQ/eXMvma'; -- 111111Aa@
    v_now timestamptz := now();
    v_today date := CURRENT_DATE;

    v_candidate_role_id uuid;
    v_hr_user_id uuid;
    v_affiliate_user_id uuid;

    v_job_be_id uuid;
    v_job_be_company_id uuid;
    v_job_be_client_id uuid;
    v_job_be_warranty_days int;
    v_job_be_fee_multiplier numeric;
    v_job_be_payment_due_days int;

    v_job_fe_id uuid;
    v_job_fe_company_id uuid;
    v_job_fe_client_id uuid;

    -- UV6
    v_uv6_user_id uuid;
    v_uv6_cand_id uuid;
    v_uv6_cv_id uuid;
    v_uv6_sub_id uuid;
    v_uv6_app_id uuid;
    v_uv6_offer_id uuid;
    v_uv6_placement_id uuid;
    v_uv6_fee_amount numeric;

    -- UV7
    v_uv7_cand_id uuid;
    v_uv7_cv_id uuid;
    v_uv7_sub_id uuid;
    v_uv7_app_id uuid;

    -- UV8
    v_uv8_cand_id uuid;
    v_uv8_cv_id uuid;
    v_uv8_sub_id uuid;
    v_uv8_app_id uuid;

    -- UV9
    v_uv9_user_id uuid;
    v_uv9_cand_id uuid;
    v_uv9_cv_id uuid;
BEGIN
    -- 0. Lookup system roles & actors
    SELECT role_id INTO v_candidate_role_id FROM public.role WHERE code = 'CANDIDATE' LIMIT 1;
    IF v_candidate_role_id IS NULL THEN
        RAISE EXCEPTION 'Missing CANDIDATE role in public.role';
    END IF;

    SELECT u.user_id INTO v_hr_user_id
    FROM public.app_user u
    JOIN public.user_role ur ON ur.user_id = u.user_id AND ur.status = 'ACTIVE'
    JOIN public.role r ON r.role_id = ur.role_id AND r.code = 'INTERNAL_HR'
    ORDER BY u.created_at
    LIMIT 1;

    SELECT u.user_id INTO v_affiliate_user_id
    FROM public.app_user u
    JOIN public.user_role ur ON ur.user_id = u.user_id AND ur.status = 'ACTIVE'
    JOIN public.role r ON r.role_id = ur.role_id AND r.code = 'AFFILIATE'
    ORDER BY u.created_at
    LIMIT 1;
    IF v_affiliate_user_id IS NULL THEN
        v_affiliate_user_id := v_hr_user_id;
    END IF;

    -- Lookup Job 1: Senior Backend Engineer (.NET) v1 (HEADHUNT_COD)
    SELECT j.job_id, j.company_id, j.created_by, COALESCE(j.warranty_days, 30), COALESCE(j.fee_multiplier, 1.5), COALESCE(j.payment_due_days, 15)
    INTO v_job_be_id, v_job_be_company_id, v_job_be_client_id, v_job_be_warranty_days, v_job_be_fee_multiplier, v_job_be_payment_due_days
    FROM public.job j
    WHERE j.title = 'Senior Backend Engineer (.NET) v1'
       OR j.title ILIKE '%Senior Backend Engineer (.NET) v1%'
    ORDER BY j.created_at DESC
    LIMIT 1;

    IF v_job_be_id IS NULL THEN
        RAISE EXCEPTION 'Job "Senior Backend Engineer (.NET) v1" not found in public.job';
    END IF;

    SELECT COALESCE(
        (SELECT cu.user_id FROM public.company_user cu WHERE cu.company_id = v_job_be_company_id LIMIT 1),
        v_job_be_client_id
    ) INTO v_job_be_client_id;

    -- Lookup Job 2: Frontend Developer (React / TypeScript) _ v1 (CV_SOURCING)
    SELECT j.job_id, j.company_id, j.created_by
    INTO v_job_fe_id, v_job_fe_company_id, v_job_fe_client_id
    FROM public.job j
    WHERE j.title = 'Frontend Developer (React / TypeScript) _ v1'
       OR j.title ILIKE '%Frontend Developer (React / TypeScript)%v1%'
    ORDER BY j.created_at DESC
    LIMIT 1;

    IF v_job_fe_id IS NULL THEN
        RAISE EXCEPTION 'Job "Frontend Developer (React / TypeScript) _ v1" not found in public.job';
    END IF;

    SELECT COALESCE(
        (SELECT cu.user_id FROM public.company_user cu WHERE cu.company_id = v_job_fe_company_id LIMIT 1),
        v_job_fe_client_id
    ) INTO v_job_fe_client_id;

    -- ========================================================================
    -- [UV6] Đặng Khánh Linh - HEADHUNT_COD (Offer 20M -> Fee 30M, UNPAID)
    -- ========================================================================
    SELECT user_id INTO v_uv6_user_id FROM public.app_user WHERE lower(email) = 'truongqui858+uv6@gmail.com' LIMIT 1;
    IF v_uv6_user_id IS NULL THEN
        v_uv6_user_id := gen_random_uuid();
        INSERT INTO public.app_user (
            user_id, email, phone, normalized_phone, password_hash, display_name,
            status, email_verified_at, failed_login_attempts, created_at, updated_at
        ) VALUES (
            v_uv6_user_id, 'truongqui858+uv6@gmail.com', '0901000006', '84901000006', c_pw_hash, 'Đặng Khánh Linh',
            'ACTIVE', v_now, 0, v_now, v_now
        );
    END IF;

    INSERT INTO public.user_role (user_id, role_id, assigned_at, assignment_source, status)
    VALUES (v_uv6_user_id, v_candidate_role_id, v_now, 'SEED', 'ACTIVE')
    ON CONFLICT (user_id, role_id) DO NOTHING;

    SELECT candidate_id INTO v_uv6_cand_id FROM public.candidate WHERE user_id = v_uv6_user_id OR normalized_email = 'truongqui858+uv6@gmail.com' LIMIT 1;
    IF v_uv6_cand_id IS NULL THEN
        v_uv6_cand_id := gen_random_uuid();
        INSERT INTO public.candidate (
            candidate_id, user_id, full_name, email, normalized_email, phone, normalized_phone,
            current_job_title, years_of_experience, expected_salary_currency, profile_visibility, status, created_at, updated_at
        ) VALUES (
            v_uv6_cand_id, v_uv6_user_id, 'Đặng Khánh Linh', 'truongqui858+uv6@gmail.com', 'truongqui858+uv6@gmail.com',
            '0901000006', '84901000006', 'Senior .NET Backend Engineer', 5, 'VND', 'PUBLIC', 'ACTIVE', v_now, v_now
        );
    END IF;

    SELECT cv_id INTO v_uv6_cv_id FROM public.candidate_cv WHERE candidate_id = v_uv6_cand_id ORDER BY is_primary DESC, created_at DESC LIMIT 1;
    IF v_uv6_cv_id IS NULL THEN
        v_uv6_cv_id := gen_random_uuid();
        INSERT INTO public.candidate_cv (
            cv_id, candidate_id, title, creation_method, structured_content, is_primary, status, created_at, updated_at
        ) VALUES (
            v_uv6_cv_id, v_uv6_cand_id, 'CV Đặng Khánh Linh - Senior .NET', 'PLATFORM_BUILDER',
            '{"fullName":"Đặng Khánh Linh","title":"Senior .NET Backend Engineer","experienceYears":5}'::jsonb,
            true, 'ACTIVE', v_now, v_now
        );
    END IF;

    SELECT submission_id INTO v_uv6_sub_id FROM public.submission WHERE job_id = v_job_be_id AND candidate_id = v_uv6_cand_id AND status = 'ACCEPTED' LIMIT 1;
    IF v_uv6_sub_id IS NULL THEN
        v_uv6_sub_id := gen_random_uuid();
        INSERT INTO public.submission (
            submission_id, job_id, candidate_id, cv_id, submitted_by, source, status,
            submitted_full_name, submitted_phone, normalized_submitted_phone, submitted_at, updated_at
        ) VALUES (
            v_uv6_sub_id, v_job_be_id, v_uv6_cand_id, v_uv6_cv_id, v_uv6_user_id, 'CANDIDATE', 'ACCEPTED',
            'Đặng Khánh Linh', '0901000006', '84901000006', v_now, v_now
        );
    END IF;

    SELECT application_id INTO v_uv6_app_id FROM public.application WHERE job_id = v_job_be_id AND candidate_id = v_uv6_cand_id LIMIT 1;
    IF v_uv6_app_id IS NULL THEN
        v_uv6_app_id := gen_random_uuid();
        INSERT INTO public.application (
            application_id, job_id, candidate_id, accepted_submission_id, status, current_stage,
            planned_start_date, applied_at, updated_at
        ) VALUES (
            v_uv6_app_id, v_job_be_id, v_uv6_cand_id, v_uv6_sub_id, 'PLACED', 'PLACED',
            v_today, v_now, v_now
        );
    END IF;

    SELECT offer_id INTO v_uv6_offer_id FROM public.offer WHERE application_id = v_uv6_app_id AND status = 'ACCEPTED' LIMIT 1;
    IF v_uv6_offer_id IS NULL THEN
        v_uv6_offer_id := gen_random_uuid();
        INSERT INTO public.offer (
            offer_id, application_id, offer_version, salary, salary_basis, salary_period, currency_code,
            start_date, status, sent_at, responded_at, created_by, created_at, updated_at
        ) VALUES (
            v_uv6_offer_id, v_uv6_app_id, 1, 20000000, 'GROSS', 'MONTHLY', 'VND',
            v_today, 'ACCEPTED', v_now - interval '2 days', v_now - interval '1 day', v_job_be_client_id, v_now, v_now
        );
    END IF;

    SELECT placement_id INTO v_uv6_placement_id FROM public.placement WHERE application_id = v_uv6_app_id LIMIT 1;
    IF v_uv6_placement_id IS NULL THEN
        v_uv6_placement_id := gen_random_uuid();
        INSERT INTO public.placement (
            placement_id, application_id, offer_id, actual_start_date, position, status,
            confirmed_by, confirmed_at, created_at, updated_at
        ) VALUES (
            v_uv6_placement_id, v_uv6_app_id, v_uv6_offer_id, v_today, 'Senior Backend Engineer (.NET)', 'STARTED',
            v_job_be_client_id, v_now, v_now, v_now
        );
    END IF;

    INSERT INTO public.placement_reconciliation (
        reconciliation_id, application_id, placement_id, claimed_outcome, status,
        contact_channel, note, reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_uv6_app_id, v_uv6_placement_id, 'STARTED', 'CONFIRMED',
        'CANDIDATE', 'HR đối soát xác nhận UV6 đã đi làm (chưa thanh toán phí).',
        v_hr_user_id, v_now, v_now, v_now
    )
    ON CONFLICT (application_id) DO NOTHING;

    INSERT INTO public.warranty (
        warranty_id, placement_id, start_date, end_date, status, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_uv6_placement_id, v_today, v_today + v_job_be_warranty_days, 'ACTIVE', v_now, v_now
    )
    ON CONFLICT (placement_id) DO NOTHING;

    v_uv6_fee_amount := ROUND(20000000 * v_job_be_fee_multiplier, 2);
    INSERT INTO public.service_fee (
        service_fee_id, placement_id, company_id, kind, base_salary, fee_multiplier, amount,
        currency_code, due_date, status, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_uv6_placement_id, v_job_be_company_id, 'PLACEMENT', 20000000,
        v_job_be_fee_multiplier, v_uv6_fee_amount, 'VND', v_today + v_job_be_payment_due_days,
        'DUE', v_now, v_now
    )
    ON CONFLICT (placement_id) DO NOTHING;

    -- ========================================================================
    -- [UV7] Bùi Gia Huy - CV_SOURCING (No account, Consent CONFIRMED, ACCEPTED)
    -- ========================================================================
    SELECT candidate_id INTO v_uv7_cand_id FROM public.candidate WHERE normalized_email = 'truongqui858+uv7@gmail.com' LIMIT 1;
    IF v_uv7_cand_id IS NULL THEN
        v_uv7_cand_id := gen_random_uuid();
        INSERT INTO public.candidate (
            candidate_id, user_id, full_name, email, normalized_email, phone, normalized_phone,
            current_job_title, years_of_experience, expected_salary_currency, profile_visibility, status, created_at, updated_at
        ) VALUES (
            v_uv7_cand_id, NULL, 'Bùi Gia Huy', 'truongqui858+uv7@gmail.com', 'truongqui858+uv7@gmail.com',
            '0901000007', '84901000007', 'Frontend Developer (React/TS)', 3, 'VND', 'PUBLIC', 'ACTIVE', v_now, v_now
        );
    END IF;

    SELECT cv_id INTO v_uv7_cv_id FROM public.candidate_cv WHERE candidate_id = v_uv7_cand_id LIMIT 1;
    IF v_uv7_cv_id IS NULL THEN
        v_uv7_cv_id := gen_random_uuid();
        INSERT INTO public.candidate_cv (
            cv_id, candidate_id, title, creation_method, source_file_url, uploaded_by_user_id,
            affiliate_reuse_status, is_primary, status, created_at, updated_at
        ) VALUES (
            v_uv7_cv_id, v_uv7_cand_id, 'CV Bùi Gia Huy - React/TS', 'AFFILIATE_UPLOAD',
            'https://cdn.hrconnectvn.online/demo/cv-uv7-bui-gia-huy.pdf', v_affiliate_user_id,
            'NOT_GRANTED', true, 'ACTIVE', v_now, v_now
        );
    END IF;

    SELECT submission_id INTO v_uv7_sub_id FROM public.submission WHERE job_id = v_job_fe_id AND candidate_id = v_uv7_cand_id AND status = 'ACCEPTED' LIMIT 1;
    IF v_uv7_sub_id IS NULL THEN
        v_uv7_sub_id := gen_random_uuid();
        INSERT INTO public.submission (
            submission_id, job_id, candidate_id, cv_id, submitted_by, source, status,
            submitted_full_name, submitted_phone, normalized_submitted_phone, submitted_at, updated_at
        ) VALUES (
            v_uv7_sub_id, v_job_fe_id, v_uv7_cand_id, v_uv7_cv_id, v_affiliate_user_id, 'AFFILIATE', 'ACCEPTED',
            'Bùi Gia Huy', '0901000007', '84901000007', v_now, v_now
        );

        INSERT INTO public.submission_consent (
            consent_id, submission_id, token_hash, recipient_email, status,
            requested_at, expires_at, email_sent_at, email_send_count, responded_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_uv7_sub_id, md5(v_uv7_sub_id::text || '-uv7'), 'truongqui858+uv7@gmail.com', 'CONFIRMED',
            v_now - interval '1 day', v_now + interval '6 days', v_now - interval '1 day', 1, v_now - interval '12 hours', v_now, v_now
        );
    END IF;

    SELECT application_id INTO v_uv7_app_id FROM public.application WHERE job_id = v_job_fe_id AND candidate_id = v_uv7_cand_id LIMIT 1;
    IF v_uv7_app_id IS NULL THEN
        v_uv7_app_id := gen_random_uuid();
        INSERT INTO public.application (
            application_id, job_id, candidate_id, accepted_submission_id, status, current_stage, applied_at, updated_at
        ) VALUES (
            v_uv7_app_id, v_job_fe_id, v_uv7_cand_id, v_uv7_sub_id, 'SHORTLISTED', 'SHORTLISTED', v_now, v_now
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.sourcing_delivery WHERE job_id = v_job_fe_id AND application_id = v_uv7_app_id) THEN
        INSERT INTO public.sourcing_delivery (
            delivery_id, job_id, application_id, status, delivered_at, delivered_by,
            review_due_at, decided_at, decided_by, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_job_fe_id, v_uv7_app_id, 'ACCEPTED', v_now - interval '2 hours', v_hr_user_id,
            v_now + interval '7 days', v_now, v_job_fe_client_id, v_now, v_now
        );
    END IF;

    -- ========================================================================
    -- [UV8] Hoàng Mỹ Duyên - CV_SOURCING (No account, Consent CONFIRMED, DELIVERED)
    -- ========================================================================
    SELECT candidate_id INTO v_uv8_cand_id FROM public.candidate WHERE normalized_email = 'truongqui858+uv8@gmail.com' LIMIT 1;
    IF v_uv8_cand_id IS NULL THEN
        v_uv8_cand_id := gen_random_uuid();
        INSERT INTO public.candidate (
            candidate_id, user_id, full_name, email, normalized_email, phone, normalized_phone,
            current_job_title, years_of_experience, expected_salary_currency, profile_visibility, status, created_at, updated_at
        ) VALUES (
            v_uv8_cand_id, NULL, 'Hoàng Mỹ Duyên', 'truongqui858+uv8@gmail.com', 'truongqui858+uv8@gmail.com',
            '0901000008', '84901000008', 'Frontend Developer (React/TS)', 3, 'VND', 'PUBLIC', 'ACTIVE', v_now, v_now
        );
    END IF;

    SELECT cv_id INTO v_uv8_cv_id FROM public.candidate_cv WHERE candidate_id = v_uv8_cand_id LIMIT 1;
    IF v_uv8_cv_id IS NULL THEN
        v_uv8_cv_id := gen_random_uuid();
        INSERT INTO public.candidate_cv (
            cv_id, candidate_id, title, creation_method, source_file_url, uploaded_by_user_id,
            affiliate_reuse_status, is_primary, status, created_at, updated_at
        ) VALUES (
            v_uv8_cv_id, v_uv8_cand_id, 'CV Hoàng Mỹ Duyên - React/TS', 'AFFILIATE_UPLOAD',
            'https://cdn.hrconnectvn.online/demo/cv-uv8-hoang-my-duyen.pdf', v_affiliate_user_id,
            'NOT_GRANTED', true, 'ACTIVE', v_now, v_now
        );
    END IF;

    SELECT submission_id INTO v_uv8_sub_id FROM public.submission WHERE job_id = v_job_fe_id AND candidate_id = v_uv8_cand_id AND status = 'ACCEPTED' LIMIT 1;
    IF v_uv8_sub_id IS NULL THEN
        v_uv8_sub_id := gen_random_uuid();
        INSERT INTO public.submission (
            submission_id, job_id, candidate_id, cv_id, submitted_by, source, status,
            submitted_full_name, submitted_phone, normalized_submitted_phone, submitted_at, updated_at
        ) VALUES (
            v_uv8_sub_id, v_job_fe_id, v_uv8_cand_id, v_uv8_cv_id, v_affiliate_user_id, 'AFFILIATE', 'ACCEPTED',
            'Hoàng Mỹ Duyên', '0901000008', '84901000008', v_now, v_now
        );

        INSERT INTO public.submission_consent (
            consent_id, submission_id, token_hash, recipient_email, status,
            requested_at, expires_at, email_sent_at, email_send_count, responded_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_uv8_sub_id, md5(v_uv8_sub_id::text || '-uv8'), 'truongqui858+uv8@gmail.com', 'CONFIRMED',
            v_now - interval '1 day', v_now + interval '6 days', v_now - interval '1 day', 1, v_now - interval '10 hours', v_now, v_now
        );
    END IF;

    SELECT application_id INTO v_uv8_app_id FROM public.application WHERE job_id = v_job_fe_id AND candidate_id = v_uv8_cand_id LIMIT 1;
    IF v_uv8_app_id IS NULL THEN
        v_uv8_app_id := gen_random_uuid();
        INSERT INTO public.application (
            application_id, job_id, candidate_id, accepted_submission_id, status, current_stage, applied_at, updated_at
        ) VALUES (
            v_uv8_app_id, v_job_fe_id, v_uv8_cand_id, v_uv8_sub_id, 'SHORTLISTED', 'SHORTLISTED', v_now, v_now
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.sourcing_delivery WHERE job_id = v_job_fe_id AND application_id = v_uv8_app_id) THEN
        INSERT INTO public.sourcing_delivery (
            delivery_id, job_id, application_id, status, delivered_at, delivered_by,
            review_due_at, decided_at, decided_by, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_job_fe_id, v_uv8_app_id, 'DELIVERED', v_now - interval '1 hour', v_hr_user_id,
            v_now + interval '7 days', NULL, NULL, v_now, v_now
        );
    END IF;

    -- ========================================================================
    -- [UV9] Trương Nhật Minh - Backup Candidate account ready to apply
    -- ========================================================================
    SELECT user_id INTO v_uv9_user_id FROM public.app_user WHERE lower(email) = 'truongqui858+uv9@gmail.com' LIMIT 1;
    IF v_uv9_user_id IS NULL THEN
        v_uv9_user_id := gen_random_uuid();
        INSERT INTO public.app_user (
            user_id, email, phone, normalized_phone, password_hash, display_name,
            status, email_verified_at, failed_login_attempts, created_at, updated_at
        ) VALUES (
            v_uv9_user_id, 'truongqui858+uv9@gmail.com', '0901000009', '84901000009', c_pw_hash, 'Trương Nhật Minh',
            'ACTIVE', v_now, 0, v_now, v_now
        );
    END IF;

    INSERT INTO public.user_role (user_id, role_id, assigned_at, assignment_source, status)
    VALUES (v_uv9_user_id, v_candidate_role_id, v_now, 'SEED', 'ACTIVE')
    ON CONFLICT (user_id, role_id) DO NOTHING;

    SELECT candidate_id INTO v_uv9_cand_id FROM public.candidate WHERE user_id = v_uv9_user_id OR normalized_email = 'truongqui858+uv9@gmail.com' LIMIT 1;
    IF v_uv9_cand_id IS NULL THEN
        v_uv9_cand_id := gen_random_uuid();
        INSERT INTO public.candidate (
            candidate_id, user_id, full_name, email, normalized_email, phone, normalized_phone,
            current_job_title, years_of_experience, expected_salary_currency, profile_visibility, status, created_at, updated_at
        ) VALUES (
            v_uv9_cand_id, v_uv9_user_id, 'Trương Nhật Minh', 'truongqui858+uv9@gmail.com', 'truongqui858+uv9@gmail.com',
            '0901000009', '84901000009', 'Senior .NET Backend Engineer', 4, 'VND', 'PUBLIC', 'ACTIVE', v_now, v_now
        );
    END IF;

    SELECT cv_id INTO v_uv9_cv_id FROM public.candidate_cv WHERE candidate_id = v_uv9_cand_id ORDER BY is_primary DESC, created_at DESC LIMIT 1;
    IF v_uv9_cv_id IS NULL THEN
        v_uv9_cv_id := gen_random_uuid();
        INSERT INTO public.candidate_cv (
            cv_id, candidate_id, title, creation_method, structured_content, is_primary, status, created_at, updated_at
        ) VALUES (
            v_uv9_cv_id, v_uv9_cand_id, 'CV Trương Nhật Minh - Senior .NET', 'PLATFORM_BUILDER',
            '{"fullName":"Trương Nhật Minh","title":"Senior .NET Backend Engineer","experienceYears":4}'::jsonb,
            true, 'ACTIVE', v_now, v_now
        );
    END IF;

    RAISE NOTICE 'Seeded UV6 (app=%, fee=%), UV7 (app=%), UV8 (app=%), UV9 (cand=%) successfully.',
        v_uv6_app_id, v_uv6_fee_amount, v_uv7_app_id, v_uv8_app_id, v_uv9_cand_id;
END $$;

COMMIT;
