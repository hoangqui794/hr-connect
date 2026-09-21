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

public static class CandidateTestJobSeeder
{
    public const string SeedJobTitle = "[SEED] Junior .NET Backend Developer";
    public const string ExpectedServiceTypeCode = "CV_APPLICATION";

    private static readonly (string Name, string Normalized, string Category, bool IsMandatory, decimal Weight)[] SeedSkills =
    [
        ("C#", "C#", "Programming Language", true, 0.30m),
        ("ASP.NET Core", "ASP.NET CORE", "Web Framework", true, 0.30m),
        ("PostgreSQL", "POSTGRESQL", "Database", false, 0.15m),
        ("REST API", "REST API", "Architecture", true, 0.15m),
        ("Git", "GIT", "Version Control", false, 0.10m)
    ];

    private static readonly (string RequirementType, string Category, string Content, decimal Weight)[] SeedRequirements =
    [
        (JobRequirementTypes.MustHave, "Experience", "0-2 years of experience in software development or equivalent academic/project experience.", 0.25m),
        (JobRequirementTypes.MustHave, "Education", "Bachelor's degree or final-year student in Software Engineering, Computer Science, or related field.", 0.15m),
        (JobRequirementTypes.MustHave, "Backend Development", "Basic knowledge of C#, ASP.NET Core, REST APIs, and relational databases.", 0.35m),
        (JobRequirementTypes.ShouldHave, "Communication", "Good communication, teamwork, and willingness to learn.", 0.10m),
        (JobRequirementTypes.ShouldHave, "English", "Able to read technical documentation in English.", 0.15m)
    ];

    /// <summary>
    /// Nạp một công việc mẫu (Job) thực tế cho phép Candidate xem và ứng tuyển trực tiếp (MF-02).
    /// Hoàn toàn idempotent: kiểm tra sự tồn tại theo Company + Title + ServiceType trước khi nạp.
    /// </summary>
    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        // 1. Phân giải Service Type theo mã nghiệp vụ 'CV_APPLICATION' (Tuyệt đối không hardcode UUID)
        var serviceType = await context.ServiceTypes
            .FirstOrDefaultAsync(st => st.Code == ExpectedServiceTypeCode, cancellationToken);

        if (serviceType == null)
        {
            logger?.LogWarning("Không tìm thấy Service Type với mã '{Code}'. Vui lòng đảm bảo ServiceTypeSeeder đã chạy.", ExpectedServiceTypeCode);
            return;
        }

        // 2. Xác thực cấu hình phân quyền service_type_allowed_role: Yêu cầu CANDIDATE có can_view=true và can_submit=true
        var candidateRole = await context.Roles
            .FirstOrDefaultAsync(r => r.Code == "CANDIDATE", cancellationToken);

        if (candidateRole != null)
        {
            var allowedMapping = await context.ServiceTypeAllowedRoles
                .FirstOrDefaultAsync(star => star.ServiceTypeId == serviceType.ServiceTypeId && star.RoleId == candidateRole.RoleId, cancellationToken);

            if (allowedMapping == null || !allowedMapping.CanView || !allowedMapping.CanSubmit)
            {
                logger?.LogWarning("ServiceTypeAllowedRole cho ServiceType {Code} và Role CANDIDATE chưa cấu hình can_view=true hoặc can_submit=true.", ExpectedServiceTypeCode);
            }
            else
            {
                logger?.LogInformation("Đã xác thực ServiceTypeAllowedRole: CANDIDATE được phép xem (can_view=true) và nộp hồ sơ (can_submit=true) cho {Code}.", ExpectedServiceTypeCode);
            }
        }

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

        // 4. Khởi tạo / phân giải danh mục kỹ năng (Skills)
        var skillMap = new Dictionary<string, Skill>(StringComparer.OrdinalIgnoreCase);

        foreach (var (name, normalized, category, _, _) in SeedSkills)
        {
            var existingSkill = await context.Skills
                .FirstOrDefaultAsync(s => s.NormalizedName == normalized || s.SkillName == name, cancellationToken);

            if (existingSkill == null)
            {
                existingSkill = new Skill
                {
                    SkillId = Guid.NewGuid(),
                    SkillName = name,
                    NormalizedName = normalized,
                    Category = category,
                    IsActive = true,
                    CreatedAt = now
                };
                await context.Skills.AddAsync(existingSkill, cancellationToken);
                await context.SaveChangesAsync(cancellationToken);
                logger?.LogInformation("Đã tạo mới kỹ năng seed: {SkillName} ({Normalized})", name, normalized);
            }

            skillMap[normalized] = existingSkill;
        }

        // 5. Kiểm tra Idempotency cho Job: CompanyId + Title + ServiceTypeId
        var existingJob = await context.Jobs
            .Include(j => j.JobRequirements)
            .Include(j => j.JobSkills)
            .FirstOrDefaultAsync(j => j.CompanyId == company.CompanyId && j.Title == SeedJobTitle && j.ServiceTypeId == serviceType.ServiceTypeId, cancellationToken);

        if (existingJob != null)
        {
            logger?.LogInformation("Job seed '{Title}' đã tồn tại (JobId: {JobId}, Status: {Status}). Bỏ qua tạo mới để đảm bảo tính Idempotent.",
                SeedJobTitle, existingJob.JobId, existingJob.Status);

            // Bổ sung requirements nếu bị thiếu
            var missingReqs = SeedRequirements
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
                logger?.LogInformation("Đã bổ sung {Count} yêu cầu còn thiếu cho Job {JobId}.", missingReqs.Count, existingJob.JobId);
            }

            // Bổ sung skills nếu bị thiếu
            var missingSkills = SeedSkills
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
                logger?.LogInformation("Đã bổ sung {Count} kỹ năng còn thiếu cho Job {JobId}.", missingSkills.Count, existingJob.JobId);
            }

            return;
        }

        // 6. Tạo mới bản ghi Job
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            ServiceTypeId = serviceType.ServiceTypeId,
            CreatedBy = creatorUserId.Value,
            Title = SeedJobTitle,
            Description = "We are looking for a Junior .NET Backend Developer to join our engineering team and work on ASP.NET Core Web API services.",
            Location = "Ho Chi Minh City",
            EmploymentType = "FULL_TIME",
            SalaryMin = 12000000m,
            SalaryMax = 18000000m,
            CurrencyCode = "VND",
            Quantity = 2,
            Visibility = JobVisibilities.Public,
            Status = JobStatuses.Active,
            PostedAt = now,
            ClosedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        await context.Jobs.AddAsync(job, cancellationToken);

        // 7. Tạo mới các JobRequirement
        foreach (var (reqType, category, content, weight) in SeedRequirements)
        {
            await context.JobRequirements.AddAsync(new JobRequirement
            {
                RequirementId = Guid.NewGuid(),
                JobId = job.JobId,
                RequirementType = reqType,
                Category = category,
                Content = content,
                Weight = weight,
                CreatedAt = now,
                UpdatedAt = now
            }, cancellationToken);
        }

        // 8. Tạo mới các JobSkill
        foreach (var (_, normalized, _, isMandatory, weight) in SeedSkills)
        {
            var skillEntity = skillMap[normalized];
            await context.JobSkills.AddAsync(new JobSkill
            {
                JobId = job.JobId,
                SkillId = skillEntity.SkillId,
                IsMandatory = isMandatory,
                Weight = weight
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
            logger?.LogWarning(ex, "Xung đột tương tranh khi nạp Job seed. Bản ghi có thể đã được nạp bởi tiến trình khác.");
            foreach (var entry in context.ChangeTracker.Entries().Where(e => e.State == EntityState.Added))
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
