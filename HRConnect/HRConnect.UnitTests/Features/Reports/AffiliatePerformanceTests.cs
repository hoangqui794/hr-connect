using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;
using HRConnect.Application.Features.Reports.Commands.RecalculateAffiliatePerformance;
using HRConnect.Application.Features.Reports.Common;
using HRConnect.Application.Features.Reports.Queries.GetAdminAffiliatePerformance;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Affiliates;
using HRConnect.Presentation.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Reports;

public class AffiliatePerformanceTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private AffiliatePerformanceRepository PerformanceRepository => new(_context);
    private AffiliateProfileRepository ProfileRepository => new(_context);
    private BusinessSettingsService Settings => new(new SystemSettingRepository(_context));
    private AffiliatePerformanceCalculationService CalculationService => new(
        PerformanceRepository,
        Settings,
        NullLogger<AffiliatePerformanceCalculationService>.Instance);

    // =========================================================================
    // 1. Phân quyền và Authorization
    // =========================================================================
    [Theory]
    [InlineData("affiliate.performance.view_own", true)]
    [InlineData("job.view", false)]
    [InlineData("report.view", false)]
    public void AffiliatePerformance_ViewOwnPermission_CheckedCorrectly(string permission, bool shouldBeAllowed)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("permission", permission)], "test"));
        PermissionAuthorization.HasPermission(principal, "affiliate.performance.view_own").Should().Be(shouldBeAllowed);
    }

    [Theory]
    [InlineData("report.view", true)]
    [InlineData("affiliate.performance.view_own", false)]
    public void AdminAffiliatePerformance_ReportViewPermission_CheckedCorrectly(string permission, bool shouldBeAllowed)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("permission", permission)], "test"));
        PermissionAuthorization.HasPermission(principal, "report.view").Should().Be(shouldBeAllowed);
    }

    // =========================================================================
    // 2. Nghiệm thu 1: 10 lượt được đồng ý, 2 người đi làm, 1 người bị VOIDED -> TotalPlacements = 1, HireRate = 0.1
    // =========================================================================
    [Fact]
    public async Task NghiemThu1_Placements_Excludes_Voided_Warranty()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        var user = new AppUser { UserId = Guid.NewGuid(), Email = "aff1@test.com", DisplayName = "Affiliate One", PasswordHash = "hash", Status = "ACTIVE" };
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };
        await _context.AppUsers.AddAsync(user);
        await _context.AffiliateProfiles.AddAsync(affiliate);

        var job = new Job { JobId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), ServiceTypeId = Guid.NewGuid(), Title = "Backend Dev", Status = "ACTIVE", CurrencyCode = "VND", Quantity = 5, CreatedAt = now, UpdatedAt = now };
        await _context.Jobs.AddAsync(job);

        // Tạo 10 submission ACCEPTED trong kỳ
        for (int i = 0; i < 10; i++)
        {
            var sub = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                CandidateId = Guid.NewGuid(),
                CvId = Guid.NewGuid(),
                JobId = job.JobId,
                SubmittedBy = user.UserId,
                Source = "AFFILIATE",
                Status = "ACCEPTED",
                SubmittedAt = now,
                UpdatedAt = now
            };
            await _context.Submissions.AddAsync(sub);

            // 2 ứng viên đi làm (PLACED), 1 người bình thường, 1 người bị VOIDED
            if (i == 0)
            {
                var app = new JobApplication { ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = sub.CandidateId, AcceptedSubmissionId = sub.SubmissionId, Status = ApplicationStates.Placed, AppliedAt = now, UpdatedAt = now };
                var placement = new Placement { PlacementId = Guid.NewGuid(), ApplicationId = app.ApplicationId, OfferId = Guid.NewGuid(), Status = PlacementStates.Started, ActualStartDate = today, ConfirmedAt = now, CreatedAt = now, UpdatedAt = now };
                var warranty = new Warranty { WarrantyId = Guid.NewGuid(), PlacementId = placement.PlacementId, Status = WarrantyStates.Active, StartDate = today, EndDate = today.AddDays(30), CreatedAt = now, UpdatedAt = now };
                placement.Warranty = warranty;
                app.Placement = placement;
                await _context.Applications.AddAsync(app);
            }
            else if (i == 1)
            {
                var app = new JobApplication { ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = sub.CandidateId, AcceptedSubmissionId = sub.SubmissionId, Status = ApplicationStates.Placed, AppliedAt = now, UpdatedAt = now };
                var placement = new Placement { PlacementId = Guid.NewGuid(), ApplicationId = app.ApplicationId, OfferId = Guid.NewGuid(), Status = PlacementStates.Started, ActualStartDate = today, ConfirmedAt = now, CreatedAt = now, UpdatedAt = now };
                var warranty = new Warranty { WarrantyId = Guid.NewGuid(), PlacementId = placement.PlacementId, Status = WarrantyStates.Voided, StartDate = today, EndDate = today.AddDays(30), CreatedAt = now, UpdatedAt = now };
                placement.Warranty = warranty;
                app.Placement = placement;
                await _context.Applications.AddAsync(app);
            }
        }
        await _context.SaveChangesAsync();

        var metrics = await PerformanceRepository.ComputeMetricsAsync(affiliate.AffiliateId, periodStart, periodEnd);
        metrics.Submissions.Should().Be(10);
        metrics.Placements.Should().Be(1); // 1 placement hợp lệ (không bị VOIDED)

        var result = await CalculationService.CalculateAndUpsertAsync(affiliate.AffiliateId, periodStart, periodEnd);
        result.TotalSubmissions.Should().Be(10);
        result.TotalPlacements.Should().Be(1);
        result.SubmissionToHireRate.Should().Be(0.1m);
    }

    // =========================================================================
    // 3. Nghiệm thu 1b: Kiểm tra 2 ví dụ công thức và đổi trọng số động
    // =========================================================================
    [Fact]
    public void NghiemThu1b_Formula_Examples_Match_Exactly()
    {
        var defaultConfig = new AffiliateRatingConfig(
            WeightHire: 0.7m,
            WeightShortlist: 0.3m,
            HireRateTarget: 0.20m,
            MinSubmissions: 5,
            ExcellentMin: 4.0m,
            GoodMin: 3.0m,
            AverageMin: 2.0m);

        // Ví dụ 1: 10 lượt, 4 qua sàng lọc, 2 tuyển được -> 4.1 / EXCELLENT
        var ex1 = AffiliateRatingCalculator.Calculate(10, 4, 2, defaultConfig);
        ex1.QualityRating.Should().Be(4.1m);
        ex1.RatingLabel.Should().Be("EXCELLENT");
        ex1.SubmissionToHireRate.Should().Be(0.2m);

        // Ví dụ 2: 10 lượt, 2 qua sàng lọc, 0 tuyển được -> 0.3 / LOW
        var ex2 = AffiliateRatingCalculator.Calculate(10, 2, 0, defaultConfig);
        ex2.QualityRating.Should().Be(0.3m);
        ex2.RatingLabel.Should().Be("LOW");
        ex2.SubmissionToHireRate.Should().Be(0m);
    }

    [Fact]
    public async Task NghiemThu1b_DynamicSettingsChange_Affects_Rating_Without_Code_Change()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        var user = new AppUser { UserId = Guid.NewGuid(), Email = "aff_dynamic@test.com", DisplayName = "Affiliate Dynamic", PasswordHash = "hash", Status = "ACTIVE" };
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };
        await _context.AppUsers.AddAsync(user);
        await _context.AffiliateProfiles.AddAsync(affiliate);

        // 10 lượt, 4 shortlisted, 2 placed
        for (int i = 0; i < 10; i++)
        {
            var sub = new Submission { SubmissionId = Guid.NewGuid(), CandidateId = Guid.NewGuid(), CvId = Guid.NewGuid(), JobId = Guid.NewGuid(), SubmittedBy = user.UserId, Source = "AFFILIATE", Status = "ACCEPTED", SubmittedAt = now, UpdatedAt = now };
            await _context.Submissions.AddAsync(sub);

            if (i < 4)
            {
                var app = new JobApplication { ApplicationId = Guid.NewGuid(), JobId = sub.JobId, CandidateId = sub.CandidateId, AcceptedSubmissionId = sub.SubmissionId, Status = i < 2 ? ApplicationStates.Placed : ApplicationStates.Shortlisted, AppliedAt = now, UpdatedAt = now };
                if (i < 2)
                {
                    app.Placement = new Placement { PlacementId = Guid.NewGuid(), ApplicationId = app.ApplicationId, OfferId = Guid.NewGuid(), Status = PlacementStates.Started, ActualStartDate = today, ConfirmedAt = now, CreatedAt = now, UpdatedAt = now };
                }
                await _context.Applications.AddAsync(app);
            }
        }
        await _context.SaveChangesAsync();

        // Lần 1: mặc định (wHire: 0.7, wShortlist: 0.3) -> 4.1 EXCELLENT
        var r1 = await CalculationService.CalculateAndUpsertAsync(affiliate.AffiliateId, periodStart, periodEnd);
        r1.QualityRating.Should().Be(4.1m);
        r1.RatingLabel.Should().Be("EXCELLENT");

        // Đổi trọng số qua cài đặt: wHire: 0.2, wShortlist: 0.8
        await _context.SystemSettings.AddAsync(new SystemSetting { SettingKey = BusinessSettingKeys.AffiliateRatingWeightHire, Value = "0.2" });
        await _context.SystemSettings.AddAsync(new SystemSetting { SettingKey = BusinessSettingKeys.AffiliateRatingWeightShortlist, Value = "0.8" });
        await _context.SaveChangesAsync();

        // Lần 2 tính lại: score = 5 * (0.2 * 1.0 + 0.8 * 0.4) = 5 * (0.2 + 0.32) = 2.6 -> AVERAGE
        var r2 = await CalculationService.CalculateAndUpsertAsync(affiliate.AffiliateId, periodStart, periodEnd);
        r2.QualityRating.Should().Be(2.6m);
        r2.RatingLabel.Should().Be("AVERAGE");
    }

    // =========================================================================
    // 4. Nghiệm thu 2: Lượt bị chặn trùng / từ chối consent không tăng TotalSubmissions
    // =========================================================================
    [Fact]
    public async Task NghiemThu2_Blocked_And_Rejected_Consents_Do_Not_Count_As_Submissions()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        var user = new AppUser { UserId = Guid.NewGuid(), Email = "aff_dup@test.com", DisplayName = "Affiliate Dup", PasswordHash = "hash", Status = "ACTIVE" };
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };
        await _context.AppUsers.AddAsync(user);
        await _context.AffiliateProfiles.AddAsync(affiliate);

        // 1 lượt ACCEPTED hợp lệ
        await _context.Submissions.AddAsync(new Submission { SubmissionId = Guid.NewGuid(), CandidateId = Guid.NewGuid(), CvId = Guid.NewGuid(), JobId = Guid.NewGuid(), SubmittedBy = user.UserId, Source = "AFFILIATE", Status = "ACCEPTED", SubmittedAt = now, UpdatedAt = now });

        // 1 lượt bị DUPLICATE
        await _context.Submissions.AddAsync(new Submission { SubmissionId = Guid.NewGuid(), CandidateId = Guid.NewGuid(), CvId = Guid.NewGuid(), JobId = Guid.NewGuid(), SubmittedBy = user.UserId, Source = "AFFILIATE", Status = "DUPLICATE", SubmittedAt = now, UpdatedAt = now });

        // 1 lượt CONSENT_REJECTED
        var subRejected = new Submission { SubmissionId = Guid.NewGuid(), CandidateId = Guid.NewGuid(), CvId = Guid.NewGuid(), JobId = Guid.NewGuid(), SubmittedBy = user.UserId, Source = "AFFILIATE", Status = "CONSENT_REJECTED", SubmittedAt = now, UpdatedAt = now };
        subRejected.Consent = new SubmissionConsent { ConsentId = Guid.NewGuid(), SubmissionId = subRejected.SubmissionId, Status = "REJECTED", RecipientEmail = "c@test.com", TokenHash = "h", CreatedAt = now, UpdatedAt = now };
        await _context.Submissions.AddAsync(subRejected);

        // 1 lượt CONSENT_EXPIRED
        var subExpired = new Submission { SubmissionId = Guid.NewGuid(), CandidateId = Guid.NewGuid(), CvId = Guid.NewGuid(), JobId = Guid.NewGuid(), SubmittedBy = user.UserId, Source = "AFFILIATE", Status = "CONSENT_EXPIRED", SubmittedAt = now, UpdatedAt = now };
        subExpired.Consent = new SubmissionConsent { ConsentId = Guid.NewGuid(), SubmissionId = subExpired.SubmissionId, Status = "EXPIRED", RecipientEmail = "c2@test.com", TokenHash = "h2", CreatedAt = now, UpdatedAt = now };
        await _context.Submissions.AddAsync(subExpired);

        await _context.SaveChangesAsync();

        var metrics = await PerformanceRepository.ComputeMetricsAsync(affiliate.AffiliateId, periodStart, periodEnd);
        metrics.Submissions.Should().Be(1); // Chỉ tính 1 lượt ACCEPTED
    }

    // =========================================================================
    // 5. Nghiệm thu 3: Dưới số lượt tối thiểu -> NEW, QualityRating = null
    // =========================================================================
    [Fact]
    public async Task NghiemThu3_Below_MinSubmissions_Returns_NEW_And_Null_Rating()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        var user = new AppUser { UserId = Guid.NewGuid(), Email = "aff_min@test.com", DisplayName = "Affiliate Min", PasswordHash = "hash", Status = "ACTIVE" };
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };
        await _context.AppUsers.AddAsync(user);
        await _context.AffiliateProfiles.AddAsync(affiliate);

        // Chỉ có 3 lượt nộp (mặc định min_submissions = 5)
        for (int i = 0; i < 3; i++)
        {
            await _context.Submissions.AddAsync(new Submission { SubmissionId = Guid.NewGuid(), CandidateId = Guid.NewGuid(), CvId = Guid.NewGuid(), JobId = Guid.NewGuid(), SubmittedBy = user.UserId, Source = "AFFILIATE", Status = "ACCEPTED", SubmittedAt = now, UpdatedAt = now });
        }
        await _context.SaveChangesAsync();

        var result = await CalculationService.CalculateAndUpsertAsync(affiliate.AffiliateId, periodStart, periodEnd);
        result.TotalSubmissions.Should().Be(3);
        result.RatingLabel.Should().Be("NEW");
        result.QualityRating.Should().BeNull();
    }

    // =========================================================================
    // 6. Nghiệm thu 4: Chạy worker / upsert 2 lần -> không tạo trùng dòng
    // =========================================================================
    [Fact]
    public async Task NghiemThu4_RunTwice_DoesNotDuplicateRows()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        var user = new AppUser { UserId = Guid.NewGuid(), Email = "aff_worker@test.com", DisplayName = "Affiliate Worker", PasswordHash = "hash", Status = "ACTIVE" };
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };
        await _context.AppUsers.AddAsync(user);
        await _context.AffiliateProfiles.AddAsync(affiliate);
        await _context.SaveChangesAsync();

        // Lần 1
        await CalculationService.CalculateAndUpsertAsync(affiliate.AffiliateId, periodStart, periodEnd);
        // Lần 2
        await CalculationService.CalculateAndUpsertAsync(affiliate.AffiliateId, periodStart, periodEnd);

        var count = await _context.AffiliatePerformances
            .CountAsync(p => p.AffiliateId == affiliate.AffiliateId && p.PeriodStart == periodStart && p.PeriodEnd == periodEnd);

        count.Should().Be(1);
    }

    // =========================================================================
    // 7. Nghiệm thu 5: Affiliate A không xem được số liệu của Affiliate B
    // =========================================================================
    [Fact]
    public async Task NghiemThu5_AffiliateA_Cannot_View_AffiliateB_Data()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        var userA = new AppUser { UserId = Guid.NewGuid(), Email = "a@test.com", DisplayName = "Affiliate A", PasswordHash = "hash", Status = "ACTIVE" };
        var affA = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userA.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };

        var userB = new AppUser { UserId = Guid.NewGuid(), Email = "b@test.com", DisplayName = "Affiliate B", PasswordHash = "hash", Status = "ACTIVE" };
        var affB = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userB.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };

        await _context.AppUsers.AddRangeAsync(userA, userB);
        await _context.AffiliateProfiles.AddRangeAsync(affA, affB);

        // Affiliate B có 10 lượt nộp
        for (int i = 0; i < 10; i++)
        {
            await _context.Submissions.AddAsync(new Submission { SubmissionId = Guid.NewGuid(), CandidateId = Guid.NewGuid(), CvId = Guid.NewGuid(), JobId = Guid.NewGuid(), SubmittedBy = userB.UserId, Source = "AFFILIATE", Status = "ACCEPTED", SubmittedAt = now, UpdatedAt = now });
        }
        await _context.SaveChangesAsync();

        // Tính snapshot cho B
        await CalculationService.CalculateAndUpsertAsync(affB.AffiliateId, periodStart, periodEnd);

        // Handler khi A truy vấn theo UserId của A
        var handler = new GetAffiliatePerformanceQueryHandler(
            ProfileRepository,
            PerformanceRepository,
            CalculationService,
            NullLogger<GetAffiliatePerformanceQueryHandler>.Instance);

        var resultA = await handler.Handle(new GetAffiliatePerformanceQuery(userA.UserId), CancellationToken.None);

        resultA.Data.Should().NotBeNull();
        resultA.Data!.AffiliateId.Should().Be(affA.AffiliateId);
        resultA.Data.TotalSubmissions.Should().Be(0); // A không có submission nào, không bị rò rỉ từ B
    }

    // =========================================================================
    // 8. Admin Recalculate Command: Validate From <= To
    // =========================================================================
    [Fact]
    public async Task RecalculateCommand_WhenFromGreaterThanTo_ThrowsBadRequestException()
    {
        var handler = new RecalculateAffiliatePerformanceCommandHandler(
            CalculationService,
            ProfileRepository,
            NullLogger<RecalculateAffiliatePerformanceCommandHandler>.Instance);

        var command = new RecalculateAffiliatePerformanceCommand(
            From: new DateOnly(2026, 12, 31),
            To: new DateOnly(2026, 1, 1));

        var act = async () => await handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*không được lớn hơn*");
    }
}
