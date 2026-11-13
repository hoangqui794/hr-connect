-- ============================================================================
-- Seed 4 Job Headhunt (HEADHUNT_COD) + Cau hinh 1 ngay de test luong MF-05
-- An toan chay nhieu lan (ON CONFLICT DO NOTHING / DO UPDATE).
-- Tu dong lookup company_id, user_id, service_type_id, skill_id theo ma/ten
-- nen chay duoc tren moi may Tester da seed DemoAccountSeeder.
-- ============================================================================

BEGIN;

-- 1. Job 1: Head of DevOps & Platform Engineering (Tester Tech Solutions)
INSERT INTO job (
    job_id,
    company_id,
    service_type_id,
    created_by,
    title,
    description,
    benefits,
    location,
    working_time,
    employment_type,
    salary_min,
    salary_max,
    salary_negotiable,
    salary_note,
    min_experience_years,
    max_experience_years,
    currency_code,
    quantity,
    status,
    fee_multiplier,
    warranty_days,
    payment_due_days,
    proposed_warranty_days,
    proposed_payment_due_days,
    application_deadline,
    posted_at,
    created_at,
    updated_at
) VALUES (
    'd4444444-4444-4444-4444-444444444444',
    (SELECT company_id FROM company WHERE tax_code = 'TESTER-TAX-001' LIMIT 1),
    (SELECT service_type_id FROM service_type WHERE code = 'HEADHUNT_COD' LIMIT 1),
    (SELECT user_id FROM app_user WHERE email = 'tester.client@gmail.com' LIMIT 1),
    '[Headhunt] Head of DevOps & Platform Engineering (Kubernetes & AWS)',
    'Tester Tech Solutions đang tìm kiếm Head of DevOps & Platform Engineering dẫn dắt hạ tầng Cloud-Native đa vùng. Bạn sẽ xây dựng nền tảng CI/CD tự động hóa toàn phần, tối ưu độ sẵn sàng 99.99% (High Availability), triển khai Observability chuẩn SRE và bảo mật hạ tầng AWS/Kubernetes cho hàng triệu người dùng.',
    '• Thu nhập: 45 - 75 triệu/tháng (Gross) + Thưởng hiệu suất quý.' || E'\n' ||
    '• Gói bảo hiểm sức khỏe cao cấp + khám sức khỏe tổng quát định kỳ.' || E'\n' ||
    '• Cấp MacBook Pro M3 Pro và ngân sách đào tạo chứng chỉ AWS/CKA.' || E'\n' ||
    '• Làm việc Hybrid linh hoạt, 16 ngày phép năm.',
    'TP. Hồ Chí Minh',
    'Thứ 2 - Thứ 6 (08:30 - 17:30)',
    'FULL_TIME',
    45000000,
    75000000,
    false,
    'Mức lương Gross thỏa thuận theo kinh nghiệm vận hành hệ thống lớn',
    5.0,
    10.0,
    'VND',
    1,
    'ACTIVE',
    1.50,
    1,
    1,
    1,
    1,
    NOW() + INTERVAL '60 days',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (job_id) DO NOTHING;

INSERT INTO job_requirement (requirement_id, job_id, requirement_type, category, content, weight, created_at, updated_at)
SELECT gen_random_uuid(), 'd4444444-4444-4444-4444-444444444444', req_type, cat, content, w, NOW(), NOW()
FROM (VALUES
    ('MUST_HAVE', 'Experience', 'Tối thiểu 5 năm kinh nghiệm DevOps/SRE và ít nhất 2 năm quản lý đội ngũ Platform Engineering.', 0.30),
    ('MUST_HAVE', 'Cloud & Container', 'Thành thạo AWS (EKS, RDS, VPC, IAM), Kubernetes, Docker, Terraform/IaC và GitOps (ArgoCD).', 0.35),
    ('SHOULD_HAVE', 'Security & Observability', 'Kinh nghiệm xây dựng hệ thống giám sát Prometheus, Grafana, OpenTelemetry và bảo mật Cloud.', 0.20),
    ('SHOULD_HAVE', 'Leadership', 'Khả năng điều phối sự cố sản xuất (Incident Response) và tối ưu chi phí hạ tầng Cloud (FinOps).', 0.15)
) AS v(req_type, cat, content, w)
WHERE NOT EXISTS (
    SELECT 1 FROM job_requirement WHERE job_id = 'd4444444-4444-4444-4444-444444444444'
);

INSERT INTO job_skill (job_id, skill_id, is_mandatory, weight)
SELECT 'd4444444-4444-4444-4444-444444444444', s.skill_id, v.is_mandatory, v.weight
FROM (VALUES
    ('Kubernetes', true, 0.30),
    ('AWS', true, 0.25),
    ('Docker', true, 0.20),
    ('Cloud Security', false, 0.15),
    ('Engineering Management', false, 0.10)
) AS v(skill_name, is_mandatory, weight)
JOIN skill s ON s.skill_name = v.skill_name
ON CONFLICT (job_id, skill_id) DO NOTHING;


-- 2. Job 2: Staff Frontend Architect (Tester Tech Solutions)
INSERT INTO job (
    job_id,
    company_id,
    service_type_id,
    created_by,
    title,
    description,
    benefits,
    location,
    working_time,
    employment_type,
    salary_min,
    salary_max,
    salary_negotiable,
    salary_note,
    min_experience_years,
    max_experience_years,
    currency_code,
    quantity,
    status,
    fee_multiplier,
    warranty_days,
    payment_due_days,
    proposed_warranty_days,
    proposed_payment_due_days,
    application_deadline,
    posted_at,
    created_at,
    updated_at
) VALUES (
    'e5555555-5555-5555-5555-555555555555',
    (SELECT company_id FROM company WHERE tax_code = 'TESTER-TAX-001' LIMIT 1),
    (SELECT service_type_id FROM service_type WHERE code = 'HEADHUNT_COD' LIMIT 1),
    (SELECT user_id FROM app_user WHERE email = 'tester.client@gmail.com' LIMIT 1),
    '[Headhunt] Staff Frontend Architect (React, TypeScript & Design System)',
    'Chịu trách nhiệm kiến trúc Frontend cấp hệ thống cho nền tảng SaaS B2B quy mô lớn tại Tester Tech Solutions. Bạn sẽ thiết kế Micro-Frontends, chuẩn hóa Design System, tối ưu Core Web Vitals và dẫn dắt chất lượng kỹ thuật cho hơn 20 kỹ sư Frontend.',
    '• Thu nhập: 40 - 65 triệu/tháng (Gross) + Lương tháng 13 và thưởng KPI.' || E'\n' ||
    '• Môi trường kỹ thuật cởi mở, review code chuẩn mực và tài trợ hội thảo công nghệ.' || E'\n' ||
    '• Làm việc linh hoạt tại văn phòng Hà Nội hoặc Remote 2 ngày/tuần.' || E'\n' ||
    '• Bảo hiểm sức khỏe toàn diện và du lịch công ty hàng năm.',
    'Hà Nội',
    'Thứ 2 - Thứ 6 (08:30 - 17:30)',
    'FULL_TIME',
    40000000,
    65000000,
    false,
    'Mức lương Gross cạnh tranh theo năng lực kiến trúc Frontend',
    4.0,
    8.0,
    'VND',
    1,
    'ACTIVE',
    1.50,
    1,
    1,
    1,
    1,
    NOW() + INTERVAL '60 days',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (job_id) DO NOTHING;

INSERT INTO job_requirement (requirement_id, job_id, requirement_type, category, content, weight, created_at, updated_at)
SELECT gen_random_uuid(), 'e5555555-5555-5555-5555-555555555555', req_type, cat, content, w, NOW(), NOW()
FROM (VALUES
    ('MUST_HAVE', 'Technical', 'Thành thạo React 18+, TypeScript chuyên sâu, State Management (Zustand/Redux), React Query và Vite/Webpack.', 0.35),
    ('MUST_HAVE', 'Architecture', 'Có kinh nghiệm xây dựng Design System, Component Library, Accessibility (WCAG) và tối ưu hiệu năng trình duyệt.', 0.30),
    ('SHOULD_HAVE', 'Testing & CI', 'Kinh nghiệm triển khai Unit/Integration Testing với Vitest, React Testing Library và E2E Playwright.', 0.20),
    ('SHOULD_HAVE', 'Collaboration', 'Phối hợp chặt chẽ với Product Design và Backend để thống nhất API contract và trải nghiệm người dùng.', 0.15)
) AS v(req_type, cat, content, w)
WHERE NOT EXISTS (
    SELECT 1 FROM job_requirement WHERE job_id = 'e5555555-5555-5555-5555-555555555555'
);

INSERT INTO job_skill (job_id, skill_id, is_mandatory, weight)
SELECT 'e5555555-5555-5555-5555-555555555555', s.skill_id, v.is_mandatory, v.weight
FROM (VALUES
    ('React', true, 0.35),
    ('TypeScript', true, 0.30),
    ('REST API', true, 0.15),
    ('Git', false, 0.10),
    ('Agile', false, 0.10)
) AS v(skill_name, is_mandatory, weight)
JOIN skill s ON s.skill_name = v.skill_name
ON CONFLICT (job_id, skill_id) DO NOTHING;


-- 3. Job 3: Senior Product Manager (Lotus Commerce)
INSERT INTO job (
    job_id,
    company_id,
    service_type_id,
    created_by,
    title,
    description,
    benefits,
    location,
    working_time,
    employment_type,
    salary_min,
    salary_max,
    salary_negotiable,
    salary_note,
    min_experience_years,
    max_experience_years,
    currency_code,
    quantity,
    status,
    fee_multiplier,
    warranty_days,
    payment_due_days,
    proposed_warranty_days,
    proposed_payment_due_days,
    application_deadline,
    posted_at,
    created_at,
    updated_at
) VALUES (
    'f6666666-6666-6666-6666-666666666666',
    (SELECT company_id FROM company WHERE tax_code = 'DEMO-TAX-005' LIMIT 1),
    (SELECT service_type_id FROM service_type WHERE code = 'HEADHUNT_COD' LIMIT 1),
    (SELECT user_id FROM app_user WHERE email = 'client5@gmail.com' LIMIT 1),
    '[Headhunt] Senior Product Manager (E-Commerce & Omnichannel)',
    'Lotus Commerce tìm kiếm Senior Product Manager làm chủ lộ trình sản phẩm cho nền tảng thương mại điện tử đa kênh (Omnichannel Checkout & Loyalty). Bạn sẽ trực tiếp phân tích hành vi người dùng, tối ưu tỷ lệ chuyển đổi và điều phối liên phòng ban Engineering, Design, Growth.',
    '• Mức lương: 42 - 70 triệu/tháng (Gross) + Thưởng doanh số và ESOP.' || E'\n' ||
    '• Bảo hiểm sức khỏe cao cấp cho bản thân và gia đình.' || E'\n' ||
    '• Ngân sách học tập và phát triển năng lực lãnh đạo sản phẩm.' || E'\n' ||
    '• Văn phòng hiện đại trung tâm Quận 1, TP. HCM.',
    'TP. Hồ Chí Minh',
    'Thứ 2 - Thứ 6 (09:00 - 18:00)',
    'FULL_TIME',
    42000000,
    70000000,
    false,
    'Mức lương Gross kèm thưởng hiệu quả tăng trưởng sản phẩm',
    4.0,
    8.0,
    'VND',
    1,
    'ACTIVE',
    1.50,
    1,
    1,
    1,
    1,
    NOW() + INTERVAL '60 days',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (job_id) DO NOTHING;

INSERT INTO job_requirement (requirement_id, job_id, requirement_type, category, content, weight, created_at, updated_at)
SELECT gen_random_uuid(), 'f6666666-6666-6666-6666-666666666666', req_type, cat, content, w, NOW(), NOW()
FROM (VALUES
    ('MUST_HAVE', 'Experience', 'Tối thiểu 4 năm kinh nghiệm Product Manager cho sản phẩm B2C/E-Commerce hoặc Fintech quy mô lớn.', 0.30),
    ('MUST_HAVE', 'Analytics', 'Ra quyết định dựa trên dữ liệu (Data-Driven), thành thạo SQL, funnel analysis, A/B testing và Power BI.', 0.30),
    ('SHOULD_HAVE', 'Discovery', 'Kỹ năng nghiên cứu người dùng (User Research), viết PRD sắc bén và quản trị Backlog theo Agile/Scrum.', 0.25),
    ('SHOULD_HAVE', 'Communication', 'Giao tiếp thuyết phục với Ban lãnh đạo và điều phối đội ngũ kỹ thuật đa chức năng.', 0.15)
) AS v(req_type, cat, content, w)
WHERE NOT EXISTS (
    SELECT 1 FROM job_requirement WHERE job_id = 'f6666666-6666-6666-6666-666666666666'
);

INSERT INTO job_skill (job_id, skill_id, is_mandatory, weight)
SELECT 'f6666666-6666-6666-6666-666666666666', s.skill_id, v.is_mandatory, v.weight
FROM (VALUES
    ('Business Analysis', true, 0.25),
    ('Agile', true, 0.25),
    ('User Research', true, 0.20),
    ('Power BI', false, 0.15),
    ('SQL', false, 0.15)
) AS v(skill_name, is_mandatory, weight)
JOIN skill s ON s.skill_name = v.skill_name
ON CONFLICT (job_id, skill_id) DO NOTHING;


-- 4. Job 4: Principal Backend Engineer (HR Connect Demo Company)
INSERT INTO job (
    job_id,
    company_id,
    service_type_id,
    created_by,
    title,
    description,
    benefits,
    location,
    working_time,
    employment_type,
    salary_min,
    salary_max,
    salary_negotiable,
    salary_note,
    min_experience_years,
    max_experience_years,
    currency_code,
    quantity,
    status,
    fee_multiplier,
    warranty_days,
    payment_due_days,
    proposed_warranty_days,
    proposed_payment_due_days,
    application_deadline,
    posted_at,
    created_at,
    updated_at
) VALUES (
    'a7777777-7777-7777-7777-777777777777',
    (SELECT company_id FROM company WHERE tax_code = 'DEMO-TAX-001' LIMIT 1),
    (SELECT service_type_id FROM service_type WHERE code = 'HEADHUNT_COD' LIMIT 1),
    (SELECT user_id FROM app_user WHERE email = 'client@gmail.com' LIMIT 1),
    '[Headhunt] Principal Backend Engineer (Java Spring Boot & Microservices)',
    'HR Connect Demo Company đang mở rộng trung tâm R&D tại Đà Nẵng và tìm kiếm Principal Backend Engineer chuyên sâu Java & Microservices. Bạn sẽ thiết kế các lõi xử lý giao dịch phân tán, tối ưu throughput cho hệ thống Enterprise và cố vấn kỹ thuật cho các team Backend.',
    '• Thu nhập: 48 - 78 triệu/tháng (Gross) + Gói thưởng cuối năm từ 2 - 3 tháng lương.' || E'\n' ||
    '• Hỗ trợ gói chuyển chỗ ở (Relocation Package) nếu chuyển về Đà Nẵng làm việc.' || E'\n' ||
    '• Bảo hiểm sức khỏe quốc tế, 18 ngày phép năm và môi trường làm việc chuẩn Agile.' || E'\n' ||
    '• Tài trợ 100% chi phí thi chứng chỉ Java / Spring / Cloud.',
    'Đà Nẵng',
    'Thứ 2 - Thứ 6 (08:30 - 17:30)',
    'FULL_TIME',
    48000000,
    78000000,
    false,
    'Mức lương Gross đàm phán trực tiếp theo năng lực kiến trúc Java',
    5.0,
    10.0,
    'VND',
    1,
    'ACTIVE',
    1.50,
    1,
    1,
    1,
    1,
    NOW() + INTERVAL '60 days',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (job_id) DO NOTHING;

INSERT INTO job_requirement (requirement_id, job_id, requirement_type, category, content, weight, created_at, updated_at)
SELECT gen_random_uuid(), 'a7777777-7777-7777-7777-777777777777', req_type, cat, content, w, NOW(), NOW()
FROM (VALUES
    ('MUST_HAVE', 'Technical', 'Thành thạo Java 17/21, Spring Boot, Spring Cloud, Hibernate/JPA và kiến trúc Microservices.', 0.35),
    ('MUST_HAVE', 'Database', 'Kinh nghiệm chuyên sâu PostgreSQL, tối ưu truy vấn, xử lý concurrency và distributed caching.', 0.25),
    ('SHOULD_HAVE', 'Messaging & Container', 'Kinh nghiệm vận hành Apache Kafka/RabbitMQ, Docker và triển khai trên Kubernetes.', 0.25),
    ('SHOULD_HAVE', 'Mentorship', 'Có kinh nghiệm code review, thiết kế chuẩn API và hướng dẫn kỹ sư Senior/Middle.', 0.15)
) AS v(req_type, cat, content, w)
WHERE NOT EXISTS (
    SELECT 1 FROM job_requirement WHERE job_id = 'a7777777-7777-7777-7777-777777777777'
);

INSERT INTO job_skill (job_id, skill_id, is_mandatory, weight)
SELECT 'a7777777-7777-7777-7777-777777777777', s.skill_id, v.is_mandatory, v.weight
FROM (VALUES
    ('Java', true, 0.30),
    ('Spring Boot', true, 0.25),
    ('PostgreSQL', true, 0.20),
    ('Docker', false, 0.15),
    ('REST API', false, 0.10)
) AS v(skill_name, is_mandatory, weight)
JOIN skill s ON s.skill_name = v.skill_name
ON CONFLICT (job_id, skill_id) DO NOTHING;


-- 5. Cau hinh moc 1 ngay trong system_setting de test MF-05 nhanh
INSERT INTO system_setting (setting_key, value, updated_at) VALUES
    ('mf05.headhunt.warranty_days', '1', NOW()),
    ('mf05.headhunt.payment_due_days', '1', NOW()),
    ('mf05.fee.due_reminder_days', '1', NOW()),
    ('mf05.replacement.fill_window_days', '1', NOW()),
    ('mf05.replacement.extension_days', '1', NOW()),
    ('mf05.replacement.refund_percent', '30', NOW()),
    ('dispute.window_days', '1', NOW())
ON CONFLICT (setting_key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
