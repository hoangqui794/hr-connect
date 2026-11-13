using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// Tự động nạp 4 công việc mẫu dịch vụ Headhunt (HEADHUNT_COD) với cấu hình bảo hành/công nợ 1 ngày
/// để Tester kiểm thử luồng MF-05 ngay khi khởi chạy Backend ở môi trường phát triển/demo.
/// Hoàn toàn idempotent: kiểm tra theo JobId hoặc (Title + ServiceTypeId) trước khi tạo mới.
/// </summary>
public static class Mf05HeadhuntTestJobSeeder
{
    public const string ServiceTypeCode = "HEADHUNT_COD";

    public record SeedRequirementDef(string RequirementType, string Category, string Content, decimal Weight);
    public record SeedSkillDef(string Name, string Normalized, string Category, bool IsMandatory, decimal Weight);

    public record SeedJobDef(
        Guid JobId,
        string Title,
        string CompanyTaxCode,
        string Description,
        string Benefits,
        string Location,
        string WorkingTime,
        string EmploymentType,
        decimal SalaryMin,
        decimal SalaryMax,
        string SalaryNote,
        decimal MinExperienceYears,
        decimal MaxExperienceYears,
        int Quantity,
        SeedRequirementDef[] Requirements,
        SeedSkillDef[] Skills
    );

    public static readonly IReadOnlyList<SeedJobDef> SeedJobs =
    [
        new SeedJobDef(
            JobId: Guid.Parse("d4444444-4444-4444-4444-444444444444"),
            Title: "[Headhunt] Head of DevOps & Platform Engineering (Kubernetes & AWS)",
            CompanyTaxCode: DemoAccountSeeder.TesterCompanyTaxCode,
            Description: "Tester Tech Solutions đang tìm kiếm Head of DevOps & Platform Engineering dẫn dắt hạ tầng Cloud-Native đa vùng. Bạn sẽ xây dựng nền tảng CI/CD tự động hóa toàn phần, tối ưu độ sẵn sàng 99.99% (High Availability), triển khai Observability chuẩn SRE và bảo mật hạ tầng AWS/Kubernetes cho hàng triệu người dùng.",
            Benefits: "• Thu nhập: 45 - 75 triệu/tháng (Gross) + Thưởng hiệu suất quý.\n• Gói bảo hiểm sức khỏe cao cấp + khám sức khỏe tổng quát định kỳ.\n• Cấp MacBook Pro M3 Pro và ngân sách đào tạo chứng chỉ AWS/CKA.\n• Làm việc Hybrid linh hoạt, 16 ngày phép năm.",
            Location: "TP. Hồ Chí Minh",
            WorkingTime: "Thứ 2 - Thứ 6 (08:30 - 17:30)",
            EmploymentType: "FULL_TIME",
            SalaryMin: 45000000m,
            SalaryMax: 75000000m,
            SalaryNote: "Mức lương Gross thỏa thuận theo kinh nghiệm vận hành hệ thống lớn",
            MinExperienceYears: 5.0m,
            MaxExperienceYears: 10.0m,
            Quantity: 1,
            Requirements:
            [
                new(JobRequirementTypes.MustHave, "Experience", "Tối thiểu 5 năm kinh nghiệm DevOps/SRE và ít nhất 2 năm quản lý đội ngũ Platform Engineering.", 0.30m),
                new(JobRequirementTypes.MustHave, "Cloud & Container", "Thành thạo AWS (EKS, RDS, VPC, IAM), Kubernetes, Docker, Terraform/IaC và GitOps (ArgoCD).", 0.35m),
                new(JobRequirementTypes.ShouldHave, "Security & Observability", "Kinh nghiệm xây dựng hệ thống giám sát Prometheus, Grafana, OpenTelemetry và bảo mật Cloud.", 0.20m),
                new(JobRequirementTypes.ShouldHave, "Leadership", "Khả năng điều phối sự cố sản xuất (Incident Response) và tối ưu chi phí hạ tầng Cloud (FinOps).", 0.15m)
            ],
            Skills:
            [
                new("Kubernetes", "KUBERNETES", "DevOps", true, 0.30m),
                new("AWS", "AWS", "Cloud", true, 0.25m),
                new("Docker", "DOCKER", "DevOps", true, 0.20m),
                new("Cloud Security", "CLOUD SECURITY", "Security", false, 0.15m),
                new("Engineering Management", "ENGINEERING MANAGEMENT", "Leadership", false, 0.10m)
            ]
        ),
        new SeedJobDef(
            JobId: Guid.Parse("e5555555-5555-5555-5555-555555555555"),
            Title: "[Headhunt] Staff Frontend Architect (React, TypeScript & Design System)",
            CompanyTaxCode: DemoAccountSeeder.TesterCompanyTaxCode,
            Description: "Chịu trách nhiệm kiến trúc Frontend cấp hệ thống cho nền tảng SaaS B2B quy mô lớn tại Tester Tech Solutions. Bạn sẽ thiết kế Micro-Frontends, chuẩn hóa Design System, tối ưu Core Web Vitals và dẫn dắt chất lượng kỹ thuật cho hơn 20 kỹ sư Frontend.",
            Benefits: "• Thu nhập: 40 - 65 triệu/tháng (Gross) + Lương tháng 13 và thưởng KPI.\n• Môi trường kỹ thuật cởi mở, review code chuẩn mực và tài trợ hội thảo công nghệ.\n• Làm việc linh hoạt tại văn phòng Hà Nội hoặc Remote 2 ngày/tuần.\n• Bảo hiểm sức khỏe toàn diện và du lịch công ty hàng năm.",
            Location: "Hà Nội",
            WorkingTime: "Thứ 2 - Thứ 6 (08:30 - 17:30)",
            EmploymentType: "FULL_TIME",
            SalaryMin: 40000000m,
            SalaryMax: 65000000m,
            SalaryNote: "Mức lương Gross cạnh tranh theo năng lực kiến trúc Frontend",
            MinExperienceYears: 4.0m,
            MaxExperienceYears: 8.0m,
            Quantity: 1,
            Requirements:
            [
                new(JobRequirementTypes.MustHave, "Technical", "Thành thạo React 18+, TypeScript chuyên sâu, State Management (Zustand/Redux), React Query và Vite/Webpack.", 0.35m),
                new(JobRequirementTypes.MustHave, "Architecture", "Có kinh nghiệm xây dựng Design System, Component Library, Accessibility (WCAG) và tối ưu hiệu năng trình duyệt.", 0.30m),
                new(JobRequirementTypes.ShouldHave, "Testing & CI", "Kinh nghiệm triển khai Unit/Integration Testing với Vitest, React Testing Library và E2E Playwright.", 0.20m),
                new(JobRequirementTypes.ShouldHave, "Collaboration", "Phối hợp chặt chẽ với Product Design và Backend để thống nhất API contract và trải nghiệm người dùng.", 0.15m)
            ],
            Skills:
            [
                new("React", "REACT", "Frontend", true, 0.35m),
                new("TypeScript", "TYPESCRIPT", "Programming Language", true, 0.30m),
                new("REST API", "REST API", "Architecture", true, 0.15m),
                new("Git", "GIT", "Version Control", false, 0.10m),
                new("Agile", "AGILE", "Methodology", false, 0.10m)
            ]
        ),
        new SeedJobDef(
            JobId: Guid.Parse("f6666666-6666-6666-6666-666666666666"),
            Title: "[Headhunt] Senior Product Manager (E-Commerce & Omnichannel)",
            CompanyTaxCode: DemoAccountSeeder.DemoCompany5TaxCode,
            Description: "Lotus Commerce tìm kiếm Senior Product Manager làm chủ lộ trình sản phẩm cho nền tảng thương mại điện tử đa kênh (Omnichannel Checkout & Loyalty). Bạn sẽ trực tiếp phân tích hành vi người dùng, tối ưu tỷ lệ chuyển đổi và điều phối liên phòng ban Engineering, Design, Growth.",
            Benefits: "• Mức lương: 42 - 70 triệu/tháng (Gross) + Thưởng doanh số và ESOP.\n• Bảo hiểm sức khỏe cao cấp cho bản thân và gia đình.\n• Ngân sách học tập và phát triển năng lực lãnh đạo sản phẩm.\n• Văn phòng hiện đại trung tâm Quận 1, TP. HCM.",
            Location: "TP. Hồ Chí Minh",
            WorkingTime: "Thứ 2 - Thứ 6 (09:00 - 18:00)",
            EmploymentType: "FULL_TIME",
            SalaryMin: 42000000m,
            SalaryMax: 70000000m,
            SalaryNote: "Mức lương Gross kèm thưởng hiệu quả tăng trưởng sản phẩm",
            MinExperienceYears: 4.0m,
            MaxExperienceYears: 8.0m,
            Quantity: 1,
            Requirements:
            [
                new(JobRequirementTypes.MustHave, "Experience", "Tối thiểu 4 năm kinh nghiệm Product Manager cho sản phẩm B2C/E-Commerce hoặc Fintech quy mô lớn.", 0.30m),
                new(JobRequirementTypes.MustHave, "Analytics", "Ra quyết định dựa trên dữ liệu (Data-Driven), thành thạo SQL, funnel analysis, A/B testing và Power BI.", 0.30m),
                new(JobRequirementTypes.ShouldHave, "Discovery", "Kỹ năng nghiên cứu người dùng (User Research), viết PRD sắc bén và quản trị Backlog theo Agile/Scrum.", 0.25m),
                new(JobRequirementTypes.ShouldHave, "Communication", "Giao tiếp thuyết phục với Ban lãnh đạo và điều phối đội ngũ kỹ thuật đa chức năng.", 0.15m)
            ],
            Skills:
            [
                new("Business Analysis", "BUSINESS ANALYSIS", "Product", true, 0.25m),
                new("Agile", "AGILE", "Methodology", true, 0.25m),
                new("User Research", "USER RESEARCH", "Product", true, 0.20m),
                new("Power BI", "POWER BI", "Analytics", false, 0.15m),
                new("SQL", "SQL", "Database", false, 0.15m)
            ]
        ),
        new SeedJobDef(
            JobId: Guid.Parse("a7777777-7777-7777-7777-777777777777"),
            Title: "[Headhunt] Principal Backend Engineer (Java Spring Boot & Microservices)",
            CompanyTaxCode: DemoAccountSeeder.DemoCompanyTaxCode,
            Description: "HR Connect Demo Company đang mở rộng trung tâm R&D tại Đà Nẵng và tìm kiếm Principal Backend Engineer chuyên sâu Java & Microservices. Bạn sẽ thiết kế các lõi xử lý giao dịch phân tán, tối ưu throughput cho hệ thống Enterprise và cố vấn kỹ thuật cho các team Backend.",
            Benefits: "• Thu nhập: 48 - 78 triệu/tháng (Gross) + Gói thưởng cuối năm từ 2 - 3 tháng lương.\n• Hỗ trợ gói chuyển chỗ ở (Relocation Package) nếu chuyển về Đà Nẵng làm việc.\n• Bảo hiểm sức khỏe quốc tế, 18 ngày phép năm và môi trường làm việc chuẩn Agile.\n• Tài trợ 100% chi phí thi chứng chỉ Java / Spring / Cloud.",
            Location: "Đà Nẵng",
            WorkingTime: "Thứ 2 - Thứ 6 (08:30 - 17:30)",
            EmploymentType: "FULL_TIME",
            SalaryMin: 48000000m,
            SalaryMax: 78000000m,
            SalaryNote: "Mức lương Gross đàm phán trực tiếp theo năng lực kiến trúc Java",
            MinExperienceYears: 5.0m,
            MaxExperienceYears: 10.0m,
            Quantity: 1,
            Requirements:
            [
                new(JobRequirementTypes.MustHave, "Technical", "Thành thạo Java 17/21, Spring Boot, Spring Cloud, Hibernate/JPA và kiến trúc Microservices.", 0.35m),
                new(JobRequirementTypes.MustHave, "Database", "Kinh nghiệm chuyên sâu PostgreSQL, tối ưu truy vấn, xử lý concurrency và distributed caching.", 0.25m),
                new(JobRequirementTypes.ShouldHave, "Messaging & Container", "Kinh nghiệm vận hành Apache Kafka/RabbitMQ, Docker và triển khai trên Kubernetes.", 0.25m),
                new(JobRequirementTypes.ShouldHave, "Mentorship", "Có kinh nghiệm code review, thiết kế chuẩn API và hướng dẫn kỹ sư Senior/Middle.", 0.15m)
            ],
            Skills:
            [
                new("Java", "JAVA", "Programming Language", true, 0.30m),
                new("Spring Boot", "SPRING BOOT", "Web Framework", true, 0.25m),
                new("PostgreSQL", "POSTGRESQL", "Database", true, 0.20m),
                new("Docker", "DOCKER", "DevOps", false, 0.15m),
                new("REST API", "REST API", "Architecture", false, 0.10m)
            ]
        )
    ];

    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var serviceType = await context.ServiceTypes
            .FirstOrDefaultAsync(st => st.Code == ServiceTypeCode, cancellationToken);
        if (serviceType == null)
        {
            logger?.LogWarning("Không tìm thấy ServiceType '{Code}'. Bỏ qua Mf05HeadhuntTestJobSeeder.", ServiceTypeCode);
            return;
        }

        var requiredTaxCodes = SeedJobs
            .Select(j => j.CompanyTaxCode)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var companies = await context.Companies
            .Include(c => c.CompanyUser)
            .Where(c => c.TaxCode != null && requiredTaxCodes.Contains(c.TaxCode))
            .ToDictionaryAsync(c => c.TaxCode!, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var taxCode in requiredTaxCodes)
        {
            if (!companies.TryGetValue(taxCode, out var company) ||
                company.CompanyUser == null ||
                !string.Equals(company.CompanyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            {
                logger?.LogWarning(
                    "Doanh nghiệp '{TaxCode}' hoặc Client đại diện chưa sẵn sàng. Bỏ qua Mf05HeadhuntTestJobSeeder.",
                    taxCode);
                return;
            }
        }

        var now = DateTime.UtcNow;
        var skillMap = await EnsureSkillsAsync(context, now, logger, cancellationToken);

        foreach (var jobDef in SeedJobs)
        {
            var existingJob = await context.Jobs
                .FirstOrDefaultAsync(
                    j => j.JobId == jobDef.JobId || (j.Title == jobDef.Title && j.ServiceTypeId == serviceType.ServiceTypeId),
                    cancellationToken);

            if (existingJob != null)
            {
                continue;
            }

            var company = companies[jobDef.CompanyTaxCode];
            var job = new Job
            {
                JobId = jobDef.JobId,
                CompanyId = company.CompanyId,
                ServiceTypeId = serviceType.ServiceTypeId,
                CreatedBy = company.CompanyUser!.UserId,
                Title = jobDef.Title,
                Description = jobDef.Description,
                Benefits = jobDef.Benefits,
                Location = jobDef.Location,
                WorkingTime = jobDef.WorkingTime,
                EmploymentType = jobDef.EmploymentType,
                SalaryMin = jobDef.SalaryMin,
                SalaryMax = jobDef.SalaryMax,
                SalaryNegotiable = false,
                SalaryNote = jobDef.SalaryNote,
                MinExperienceYears = jobDef.MinExperienceYears,
                MaxExperienceYears = jobDef.MaxExperienceYears,
                CurrencyCode = "VND",
                Quantity = jobDef.Quantity,
                Status = JobStatuses.Active,
                FeeMultiplier = 1.50m,
                WarrantyDays = 1,
                PaymentDueDays = 1,
                ProposedWarrantyDays = 1,
                ProposedPaymentDueDays = 1,
                ApplicationDeadline = now.AddDays(60),
                PostedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.Jobs.AddAsync(job, cancellationToken);

            foreach (var req in jobDef.Requirements)
            {
                await context.JobRequirements.AddAsync(new JobRequirement
                {
                    RequirementId = Guid.NewGuid(),
                    JobId = job.JobId,
                    RequirementType = req.RequirementType,
                    Category = req.Category,
                    Content = req.Content,
                    Weight = req.Weight,
                    CreatedAt = now,
                    UpdatedAt = now
                }, cancellationToken);
            }

            foreach (var s in jobDef.Skills)
            {
                await context.JobSkills.AddAsync(new JobSkill
                {
                    JobId = job.JobId,
                    SkillId = skillMap[s.Normalized].SkillId,
                    IsMandatory = s.IsMandatory,
                    Weight = s.Weight
                }, cancellationToken);
            }

            try
            {
                await context.SaveChangesAsync(cancellationToken);
                logger?.LogInformation(
                    "Đã tự động nạp Job Headhunt test MF-05 '{Title}' (JobId: {JobId}) cho '{Company}'.",
                    job.Title, job.JobId, company.CompanyName);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                logger?.LogWarning(ex, "Job test MF-05 '{Title}' đã được tiến trình khác nạp.", jobDef.Title);
                foreach (var entry in context.ChangeTracker.Entries().Where(e => e.State == EntityState.Added))
                {
                    entry.State = EntityState.Detached;
                }
            }
        }
    }

    private static async Task<Dictionary<string, Skill>> EnsureSkillsAsync(
        ApplicationDbContext context,
        DateTime now,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var allUniqueSkills = SeedJobs
            .SelectMany(j => j.Skills)
            .GroupBy(s => s.Normalized, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        var skillMap = new Dictionary<string, Skill>(StringComparer.OrdinalIgnoreCase);

        foreach (var skillDef in allUniqueSkills)
        {
            var existingSkill = await context.Skills.FirstOrDefaultAsync(
                s => s.NormalizedName == skillDef.Normalized || s.SkillName == skillDef.Name,
                cancellationToken);

            if (existingSkill == null)
            {
                existingSkill = new Skill
                {
                    SkillId = Guid.NewGuid(),
                    SkillName = skillDef.Name,
                    NormalizedName = skillDef.Normalized,
                    Category = skillDef.Category,
                    IsActive = true,
                    CreatedAt = now
                };
                await context.Skills.AddAsync(existingSkill, cancellationToken);
                await context.SaveChangesAsync(cancellationToken);
                logger?.LogInformation("Đã tạo kỹ năng seed MF-05: {SkillName}", skillDef.Name);
            }

            skillMap[skillDef.Normalized] = existingSkill;
        }

        return skillMap;
    }
}
