-- Thay test_run_id bằng giá trị @testRunId trong JobManagement.DatabaseTests.http.
-- Ví dụ: DBTEST-20260921-MF01-01

-- 0. Kiểm tra hệ thống đã có tài khoản INTERNAL_HR để chạy TC-06/TC-07 hay chưa.
SELECT u.user_id, u.email, u.status, r.code AS role_code, ur.status AS role_status
FROM public.app_user u
JOIN public.user_role ur ON ur.user_id = u.user_id
JOIN public.role r ON r.role_id = ur.role_id
WHERE r.code = 'INTERNAL_HR';

-- 1. Xem Job chính và thông tin Company/Service Type.
SELECT
    j.job_id,
    j.title,
    j.status,
    j.status_reason,
    j.visibility,
    j.quantity,
    j.salary_min,
    j.salary_max,
    j.currency_code,
    j.posted_at,
    j.closed_at,
    j.created_at,
    j.updated_at,
    c.company_name,
    st.code AS service_type_code,
    u.email AS created_by_email
FROM public.job j
JOIN public.company c ON c.company_id = j.company_id
JOIN public.service_type st ON st.service_type_id = j.service_type_id
JOIN public.app_user u ON u.user_id = j.created_by
WHERE j.title LIKE 'DBTEST-20260921-MF01-01%'
ORDER BY j.created_at DESC;

-- 2. Xem Requirements đã được lưu/thay thế sau Update Job.
SELECT
    j.job_id,
    j.title,
    r.requirement_id,
    r.requirement_type,
    r.category,
    r.content,
    r.weight,
    r.created_at
FROM public.job j
JOIN public.job_requirement r ON r.job_id = j.job_id
WHERE j.title LIKE 'DBTEST-20260921-MF01-01%'
ORDER BY j.created_at DESC, r.requirement_type, r.created_at;

-- 3. Xem toàn bộ state transition theo đúng thứ tự thời gian.
SELECT
    j.job_id,
    j.title,
    h.old_status,
    h.new_status,
    h.reason,
    changer.email AS changed_by_email,
    h.changed_at
FROM public.job j
JOIN public.job_status_history h ON h.job_id = j.job_id
LEFT JOIN public.app_user changer ON changer.user_id = h.changed_by
WHERE j.title LIKE 'DBTEST-20260921-MF01-01%'
ORDER BY j.created_at DESC, h.changed_at;

-- 4. Tổng hợp nhanh số lượng history/requirement của mỗi Job test.
SELECT
    j.job_id,
    j.title,
    j.status,
    COUNT(DISTINCT r.requirement_id) AS requirement_count,
    COUNT(DISTINCT h.job_status_history_id) AS status_history_count
FROM public.job j
LEFT JOIN public.job_requirement r ON r.job_id = j.job_id
LEFT JOIN public.job_status_history h ON h.job_id = j.job_id
WHERE j.title LIKE 'DBTEST-20260921-MF01-01%'
GROUP BY j.job_id, j.title, j.status
ORDER BY MAX(j.created_at) DESC;

-- 5. Kiểm tra Skills tạo thành JD chuẩn hóa cho MF-03.
SELECT j.job_id, j.title, s.skill_id, s.skill_name, js.is_mandatory, js.weight
FROM public.job j
JOIN public.job_skill js ON js.job_id = j.job_id
JOIN public.skill s ON s.skill_id = js.skill_id
WHERE j.title LIKE 'DBTEST-20260921-MF01-01%'
ORDER BY j.created_at DESC, s.skill_name;

-- 6. Kiểm tra ma trận quyền mặc định của ba Service Type.
SELECT st.code AS service_type_code, r.code AS role_code, mapping.can_view, mapping.can_submit
FROM public.service_type_allowed_role mapping
JOIN public.service_type st ON st.service_type_id = mapping.service_type_id
JOIN public.role r ON r.role_id = mapping.role_id
WHERE st.code IN ('HEADHUNT_COD', 'CV_APPLICATION', 'CV_SOURCING')
  AND r.code IN ('CANDIDATE', 'AFFILIATE_RECRUITER')
ORDER BY st.code, r.code;

-- Cleanup có chủ đích (KHÔNG tự động chạy).
-- Chỉ bỏ comment sau khi đã kiểm tra đúng job_id cần xóa.
-- BEGIN;
-- DELETE FROM public.job_status_history WHERE job_id = 'PUT-JOB-ID-HERE';
-- DELETE FROM public.job_requirement WHERE job_id = 'PUT-JOB-ID-HERE';
-- DELETE FROM public.job_skill WHERE job_id = 'PUT-JOB-ID-HERE';
-- DELETE FROM public.job WHERE job_id = 'PUT-JOB-ID-HERE';
-- COMMIT;
