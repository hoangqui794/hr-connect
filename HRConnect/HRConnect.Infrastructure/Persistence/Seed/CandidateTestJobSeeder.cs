using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// Nạp các công việc mẫu (Job) thực tế đại diện cho toàn bộ 3 loại hình dịch vụ tuyển dụng:
/// 1. CV_APPLICATION: Ứng viên tự ứng tuyển (Candidate Self-Apply).
/// 2. HEADHUNT_COD: Affiliate Recruiter giới thiệu ứng viên nhận hoa hồng COD.
/// 3. CV_SOURCING: Cả Ứng viên và Affiliate Recruiter đều được phép nộp hồ sơ.
/// Hoàn toàn idempotent: kiểm tra sự tồn tại theo Company + Title + ServiceType trước khi nạp.
/// </summary>
public static class CandidateTestJobSeeder
{
    // Hằng số tiêu đề công việc và mã loại hình dịch vụ
    public const string SeedJobTitle = "[SEED] Junior .NET Backend Developer";
    public const string ExpectedServiceTypeCode = "CV_APPLICATION";

    public const string Job1Title = "[SEED] Junior .NET Backend Developer";
    public const string Job1ServiceTypeCode = "CV_APPLICATION";

    public const string Job2Title = "[SEED] Senior .NET Backend Developer - Headhunt";
    public const string Job2ServiceTypeCode = "HEADHUNT_COD";

    public const string Job3Title = "[SEED] Full Stack .NET Developer - CV Sourcing";
    public const string Job3ServiceTypeCode = "CV_SOURCING";

    public static readonly string[] AllSeedJobTitles = [Job1Title, Job2Title, Job3Title];

    public record SeedRequirementDef(string RequirementType, string Category, string Content, decimal Weight);
    public record SeedSkillDef(string Name, string Normalized, string Category, bool IsMandatory, decimal Weight);

    public record SeedJobDef(
        string Title,
        string ServiceTypeCode,
        string Description,
        string Location,
        string EmploymentType,
        decimal SalaryMin,
        decimal SalaryMax,
        string CurrencyCode,
        int Quantity,
        SeedRequirementDef[] Requirements,
        SeedSkillDef[] Skills
    );

    private static readonly SeedJobDef[] SeedJobs =
    [
        // ----------------------------------------------------------------------
        // JOB 1: CV_APPLICATION (Candidate Self-Apply)
        // ----------------------------------------------------------------------
        new SeedJobDef(
            Title: Job1Title,
            ServiceTypeCode: Job1ServiceTypeCode,
            Description: "We are looking for a Junior .NET Backend Developer to join our engineering team and work with ASP.NET Core Web API, relational databases, and modern backend development practices.",
            Location: "Ho Chi Minh City",
            EmploymentType: "FULL_TIME",
            SalaryMin: 12000000m,
            SalaryMax: 18000000m,
            CurrencyCode: "VND",
            Quantity: 2,
            Requirements:
            [
                new(JobRequirementTypes.MustHave, "Experience", "0–2 years of experience in software development or equivalent academic/project experience.", 0.20m),
                new(JobRequirementTypes.MustHave, "Technical", "Basic knowledge of C#, ASP.NET Core, REST APIs, and relational databases.", 0.35m),
                new(JobRequirementTypes.MustHave, "Database", "Basic understanding of SQL and PostgreSQL relational database design.", 0.15m),
                new(JobRequirementTypes.ShouldHave, "Education", "Bachelor's degree or final-year student in Software Engineering, Computer Science, or equivalent.", 0.15m),
                new(JobRequirementTypes.ShouldHave, "Communication", "Good teamwork, communication skills, and willingness to learn.", 0.15m)
            ],
            Skills:
            [
                new("C#", "C#", "Programming Language", true, 0.30m),
                new("ASP.NET Core", "ASP.NET CORE", "Web Framework", true, 0.30m),
                new("PostgreSQL", "POSTGRESQL", "Database", false, 0.15m),
                new("REST API", "REST API", "Architecture", true, 0.15m),
                new("Git", "GIT", "Version Control", false, 0.10m)
            ]
        ),

        // ----------------------------------------------------------------------
        // JOB 2: HEADHUNT_COD (Affiliate Recruiter Candidate Submission)
        // ----------------------------------------------------------------------
        new SeedJobDef(
            Title: Job2Title,
            ServiceTypeCode: Job2ServiceTypeCode,
            Description: "We are looking for an experienced .NET Backend Developer through our affiliate headhunting network. Strong experience with C#, ASP.NET Core, REST APIs, PostgreSQL, and backend architecture is preferred.",
            Location: "Ho Chi Minh City",
            EmploymentType: "FULL_TIME",
            SalaryMin: 25000000m,
            SalaryMax: 40000000m,
            CurrencyCode: "VND",
            Quantity: 2,
            Requirements:
            [
                new(JobRequirementTypes.MustHave, "Experience", "3+ years of professional backend development experience with .NET ecosystem.", 0.30m),
                new(JobRequirementTypes.MustHave, "Technical", "Strong experience in ASP.NET Core Web API, microservices, and backend clean architecture.", 0.30m),
                new(JobRequirementTypes.MustHave, "Database", "Advanced knowledge of PostgreSQL, database optimization, indexing, and EF Core.", 0.15m),
                new(JobRequirementTypes.ShouldHave, "Deployment/Engineering", "Experience with Docker, containerization, CI/CD pipelines, and production deployments.", 0.15m),
                new(JobRequirementTypes.ShouldHave, "Communication", "Effective cross-functional collaboration, problem-solving mindset, and mentoring junior engineers.", 0.10m)
            ],
            Skills:
            [
                new("C#", "C#", "Programming Language", true, 0.25m),
                new("ASP.NET Core", "ASP.NET CORE", "Web Framework", true, 0.25m),
                new("PostgreSQL", "POSTGRESQL", "Database", true, 0.20m),
                new("REST API", "REST API", "Architecture", true, 0.15m),
                new("Docker", "DOCKER", "DevOps", false, 0.15m)
            ]
        ),

        // ----------------------------------------------------------------------
        // JOB 3: CV_SOURCING (Both Candidate & Affiliate Recruiter Allowed)
        // ----------------------------------------------------------------------
        new SeedJobDef(
            Title: Job3Title,
            ServiceTypeCode: Job3ServiceTypeCode,
            Description: "We are sourcing qualified Full Stack .NET Developers with experience in ASP.NET Core, frontend frameworks, REST APIs, SQL databases, and software development best practices.",
            Location: "Ho Chi Minh City",
            EmploymentType: "FULL_TIME",
            SalaryMin: 18000000m,
            SalaryMax: 30000000m,
            CurrencyCode: "VND",
            Quantity: 3,
            Requirements:
            [
                new(JobRequirementTypes.MustHave, "Experience", "1–3 years of professional full-stack software development experience.", 0.20m),
                new(JobRequirementTypes.MustHave, "Backend", "Proficiency in C#, ASP.NET Core, and building RESTful Web APIs.", 0.25m),
                new(JobRequirementTypes.MustHave, "Frontend", "Hands-on experience with modern frontend frameworks such as React, Angular, or Vue.", 0.20m),
                new(JobRequirementTypes.MustHave, "Database", "Solid understanding of SQL, PostgreSQL relational databases, and ORM tools.", 0.15m),
                new(JobRequirementTypes.ShouldHave, "Software Engineering", "Experience with Git version control, unit testing, agile methodology, and teamwork.", 0.20m)
            ],
            Skills:
            [
                new("C#", "C#", "Programming Language", true, 0.20m),
                new("ASP.NET Core", "ASP.NET CORE", "Web Framework", true, 0.20m),
                new("React", "REACT", "Frontend Framework", false, 0.20m),
                new("PostgreSQL", "POSTGRESQL", "Database", true, 0.15m),
                new("REST API", "REST API", "Architecture", true, 0.15m),
                new("Git", "GIT", "Version Control", false, 0.10m)
            ]
        )
    ];

    /// <summary>
    /// Nạp các công việc mẫu (Job) cho toàn bộ 3 loại hình dịch vụ: CV_APPLICATION, HEADHUNT_COD, CV_SOURCING.
    /// Hoàn toàn idempotent: kiểm tra sự tồn tại theo Company + Title + ServiceType trước khi nạp.
    /// </summary>
    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        // 1. Phân giải toàn bộ Service Types cần thiết (tuyệt đối không hardcode UUID)
        var requiredServiceTypeCodes = SeedJobs.Select(j => j.ServiceTypeCode).Distinct().ToList();
        var serviceTypes = await context.ServiceTypes
            .Where(st => requiredServiceTypeCodes.Contains(st.Code))
            .ToDictionaryAsync(st => st.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var code in requiredServiceTypeCodes)
        {
            if (!serviceTypes.ContainsKey(code))
            {
                logger?.LogWarning("Không tìm thấy Service Type với mã '{Code}'. Vui lòng đảm bảo ServiceTypeSeeder đã chạy.", code);
                return;
            }
        }

        // 2. Xác thực cấu hình phân quyền service_type_allowed_role
        await VerifyServiceTypeAllowedRolesAsync(context, serviceTypes, logger, cancellationToken);

        // 3. Phân giải Doanh nghiệp (Company) và Người tạo (CreatedBy)
        var company = await context.Companies
            .FirstOrDefaultAsync(c => c.CompanyName == "HR Connect Demo Company" || c.TaxCode == "DEMO-TAX-001", cancellationToken)
            ?? await context.Companies.FirstOrDefaultAsync(c => c.VerificationStatus == "VERIFIED", cancellationToken);

        if (company == null)
        {
            company = new Company
            {
                CompanyId = Guid.NewGuid(),
                CompanyName = "HR Connect Demo Company",
                TaxCode = "DEMO-TAX-001",
                Industry = "Technology",
                CompanySize = "50-100",
                VerificationStatus = "VERIFIED",
                VerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };
            await context.Companies.AddAsync(company, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Đã khởi tạo công ty seed tối thiểu: {CompanyName}", company.CompanyName);
        }

        // Tìm người tạo: ưu tiên Client Company User liên kết với công ty
        var companyUser = await context.CompanyUsers
            .Include(cu => cu.User)
            .FirstOrDefaultAsync(cu => cu.CompanyId == company.CompanyId && cu.Status == "ACTIVE", cancellationToken);

        var creatorUserId = companyUser?.UserId;
        if (!creatorUserId.HasValue)
        {
            var clientUser = await context.AppUsers
                .FirstOrDefaultAsync(u => u.Email == "client@gmail.com", cancellationToken);
            creatorUserId = clientUser?.UserId;
        }

        if (!creatorUserId.HasValue)
        {
            var anyUser = await context.AppUsers.FirstOrDefaultAsync(u => u.Status == "ACTIVE", cancellationToken);
            if (anyUser != null)
            {
                creatorUserId = anyUser.UserId;
            }
            else
            {
                var newClientUser = new AppUser
                {
                    UserId = Guid.NewGuid(),
                    Email = "client@gmail.com",
                    DisplayName = "Demo Client",
                    Status = "ACTIVE",
                    EmailVerifiedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await context.AppUsers.AddAsync(newClientUser, cancellationToken);
                await context.SaveChangesAsync(cancellationToken);
                creatorUserId = newClientUser.UserId;
                logger?.LogInformation("Đã khởi tạo người dùng seed tối thiểu: {Email}", newClientUser.Email);
            }
        }

        // Đảm bảo liên kết CompanyUser tồn tại giữa Company và CreatorUser
        var existingCompanyUser = await context.CompanyUsers
            .FirstOrDefaultAsync(cu => cu.CompanyId == company.CompanyId && cu.UserId == creatorUserId.Value, cancellationToken);
        if (existingCompanyUser == null)
        {
            existingCompanyUser = new CompanyUser
            {
                CompanyUserId = Guid.NewGuid(),
                CompanyId = company.CompanyId,
                UserId = creatorUserId.Value,
                RoleInCompany = "HR Manager",
                IsPrimaryContact = true,
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };
            await context.CompanyUsers.AddAsync(existingCompanyUser, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
        }

        // 4. Khởi tạo / phân giải danh mục toàn bộ kỹ năng (Skills) trên tất cả Jobs
        var allUniqueSkills = SeedJobs
            .SelectMany(j => j.Skills)
            .GroupBy(s => s.Normalized, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        var skillMap = new Dictionary<string, Skill>(StringComparer.OrdinalIgnoreCase);

        foreach (var skillDef in allUniqueSkills)
        {
            var existingSkill = await context.Skills
                .FirstOrDefaultAsync(s => s.NormalizedName == skillDef.Normalized || s.SkillName == skillDef.Name, cancellationToken);

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
                logger?.LogInformation("Đã tạo mới kỹ năng seed: {SkillName} ({Normalized})", skillDef.Name, skillDef.Normalized);
            }

            skillMap[skillDef.Normalized] = existingSkill;
        }

        // 5. Nạp từng Job theo danh sách SeedJobs (Idempotent: CompanyId + Title + ServiceTypeId)
        foreach (var jobDef in SeedJobs)
        {
            var serviceType = serviceTypes[jobDef.ServiceTypeCode];

            var existingJob = await context.Jobs
                .Include(j => j.JobRequirements)
                .Include(j => j.JobSkills)
                .FirstOrDefaultAsync(j => j.CompanyId == company.CompanyId && j.Title == jobDef.Title && j.ServiceTypeId == serviceType.ServiceTypeId, cancellationToken);

            if (existingJob != null)
            {
                logger?.LogInformation("Job seed '{Title}' đã tồn tại (JobId: {JobId}, Status: {Status}). Bỏ qua tạo mới để đảm bảo tính Idempotent.",
                    jobDef.Title, existingJob.JobId, existingJob.Status);

                // Bổ sung requirements nếu bị thiếu
                var missingReqs = jobDef.Requirements
                    .Where(r => !existingJob.JobRequirements.Any(jr => jr.Category == r.Category && jr.Content == r.Content))
                    .ToList();

                if (missingReqs.Count > 0)
                {
                    foreach (var req in missingReqs)
                    {
                        await context.JobRequirements.AddAsync(new JobRequirement
                        {
                            RequirementId = Guid.NewGuid(),
                            JobId = existingJob.JobId,
                            RequirementType = req.RequirementType,
                            Category = req.Category,
                            Content = req.Content,
                            Weight = req.Weight,
                            CreatedAt = now,
                            UpdatedAt = now
                        }, cancellationToken);
                    }
                    await context.SaveChangesAsync(cancellationToken);
                    logger?.LogInformation("Đã bổ sung {Count} yêu cầu còn thiếu cho Job '{Title}' (JobId: {JobId}).",
                        missingReqs.Count, jobDef.Title, existingJob.JobId);
                }

                // Bổ sung skills nếu bị thiếu
                var missingSkills = jobDef.Skills
                    .Where(s => !existingJob.JobSkills.Any(js => js.SkillId == skillMap[s.Normalized].SkillId))
                    .ToList();

                if (missingSkills.Count > 0)
                {
                    foreach (var s in missingSkills)
                    {
                        await context.JobSkills.AddAsync(new JobSkill
                        {
                            JobId = existingJob.JobId,
                            SkillId = skillMap[s.Normalized].SkillId,
                            IsMandatory = s.IsMandatory,
                            Weight = s.Weight
                        }, cancellationToken);
                    }
                    await context.SaveChangesAsync(cancellationToken);
                    logger?.LogInformation("Đã bổ sung {Count} kỹ năng còn thiếu cho Job '{Title}' (JobId: {JobId}).",
                        missingSkills.Count, jobDef.Title, existingJob.JobId);
                }

                continue;
            }

            // Tạo mới bản ghi Job
            var job = new Job
            {
                JobId = Guid.NewGuid(),
                CompanyId = company.CompanyId,
                ServiceTypeId = serviceType.ServiceTypeId,
                CreatedBy = creatorUserId.Value,
                Title = jobDef.Title,
                Description = jobDef.Description,
                Location = jobDef.Location,
                EmploymentType = jobDef.EmploymentType,
                SalaryMin = jobDef.SalaryMin,
                SalaryMax = jobDef.SalaryMax,
                CurrencyCode = jobDef.CurrencyCode,
                Quantity = jobDef.Quantity,
                Visibility = JobVisibilities.Public,
                Status = JobStatuses.Active,
                PostedAt = now,
                ClosedAt = null,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.Jobs.AddAsync(job, cancellationToken);

            // Tạo mới các JobRequirement
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

            // Tạo mới các JobSkill
            foreach (var s in jobDef.Skills)
            {
                var skillEntity = skillMap[s.Normalized];
                await context.JobSkills.AddAsync(new JobSkill
                {
                    JobId = job.JobId,
                    SkillId = skillEntity.SkillId,
                    IsMandatory = s.IsMandatory,
                    Weight = s.Weight
                }, cancellationToken);
            }

            try
            {
                await context.SaveChangesAsync(cancellationToken);
                logger?.LogInformation("Đã nạp thành công Job seed '{Title}' (JobId: {JobId}) thuộc ServiceType '{ServiceType}' cho Doanh nghiệp '{Company}'.",
                    job.Title, job.JobId, serviceType.Code, company.CompanyName);
            }
            catch (DbUpdateException ex)
            {
                logger?.LogWarning(ex, "Xung đột tương tranh khi nạp Job seed '{Title}'. Bản ghi có thể đã được nạp bởi tiến trình khác.", jobDef.Title);
                foreach (var entry in context.ChangeTracker.Entries().Where(e => e.State == EntityState.Added))
                {
                    entry.State = EntityState.Detached;
                }
            }
        }
    }

    private static async Task VerifyServiceTypeAllowedRolesAsync(
        ApplicationDbContext context,
        Dictionary<string, ServiceType> serviceTypes,
        ILogger? logger,
        CancellationToken cancellationToken)
    {
        var candidateRole = await context.Roles.FirstOrDefaultAsync(r => r.Code == "CANDIDATE", cancellationToken);
        var affiliateRole = await context.Roles.FirstOrDefaultAsync(r => r.Code == "AFFILIATE_RECRUITER", cancellationToken);

        if (candidateRole == null || affiliateRole == null)
        {
            logger?.LogWarning("Roles CANDIDATE hoặc AFFILIATE_RECRUITER chưa được nạp trong cơ sở dữ liệu.");
            return;
        }

        // 1. Kiểm tra CV_APPLICATION -> CANDIDATE
        if (serviceTypes.TryGetValue("CV_APPLICATION", out var cvAppSt))
        {
            var mapping = await context.ServiceTypeAllowedRoles
                .FirstOrDefaultAsync(star => star.ServiceTypeId == cvAppSt.ServiceTypeId && star.RoleId == candidateRole.RoleId, cancellationToken);

            if (mapping == null || !mapping.CanView || !mapping.CanSubmit)
            {
                logger?.LogWarning("ServiceTypeAllowedRole cho CV_APPLICATION và Role CANDIDATE chưa đủ quyền can_view=true, can_submit=true.");
            }
            else
            {
                logger?.LogInformation("Đã xác thực quyền CV_APPLICATION: CANDIDATE can_view=true, can_submit=true.");
            }
        }

        // 2. Kiểm tra HEADHUNT_COD -> AFFILIATE_RECRUITER
        if (serviceTypes.TryGetValue("HEADHUNT_COD", out var headhuntSt))
        {
            var mapping = await context.ServiceTypeAllowedRoles
                .FirstOrDefaultAsync(star => star.ServiceTypeId == headhuntSt.ServiceTypeId && star.RoleId == affiliateRole.RoleId, cancellationToken);

            if (mapping == null || !mapping.CanView || !mapping.CanSubmit)
            {
                logger?.LogWarning("ServiceTypeAllowedRole cho HEADHUNT_COD và Role AFFILIATE_RECRUITER chưa đủ quyền can_view=true, can_submit=true.");
            }
            else
            {
                logger?.LogInformation("Đã xác thực quyền HEADHUNT_COD: AFFILIATE_RECRUITER can_view=true, can_submit=true.");
            }
        }

        // 3. Kiểm tra CV_SOURCING -> CANDIDATE và AFFILIATE_RECRUITER
        if (serviceTypes.TryGetValue("CV_SOURCING", out var sourcingSt))
        {
            var candMapping = await context.ServiceTypeAllowedRoles
                .FirstOrDefaultAsync(star => star.ServiceTypeId == sourcingSt.ServiceTypeId && star.RoleId == candidateRole.RoleId, cancellationToken);
            var affMapping = await context.ServiceTypeAllowedRoles
                .FirstOrDefaultAsync(star => star.ServiceTypeId == sourcingSt.ServiceTypeId && star.RoleId == affiliateRole.RoleId, cancellationToken);

            if (candMapping == null || !candMapping.CanView || !candMapping.CanSubmit)
            {
                logger?.LogWarning("ServiceTypeAllowedRole cho CV_SOURCING và Role CANDIDATE chưa đủ quyền can_view=true, can_submit=true.");
            }
            else
            {
                logger?.LogInformation("Đã xác thực quyền CV_SOURCING: CANDIDATE can_view=true, can_submit=true.");
            }

            if (affMapping == null || !affMapping.CanView || !affMapping.CanSubmit)
            {
                logger?.LogWarning("ServiceTypeAllowedRole cho CV_SOURCING và Role AFFILIATE_RECRUITER chưa đủ quyền can_view=true, can_submit=true.");
            }
            else
            {
                logger?.LogInformation("Đã xác thực quyền CV_SOURCING: AFFILIATE_RECRUITER can_view=true, can_submit=true.");
            }
        }
    }
}
