using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Reports.Common;
using HRConnect.Application.Features.Reports.Queries.GetReportOverview;
using HRConnect.Application.Features.Reports.Queries.GetReportRevenue;
using HRConnect.Application.Features.Reports.Queries.GetReportTopAffiliates;
using HRConnect.Application.Features.Reports.Queries.GetReportTopCompanies;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Presentation.Authorization;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Reports;

public class ReportFeaturesTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private ReportRepository Repository => new(_context);
    private BusinessSettingsService Settings => new(new SystemSettingRepository(_context));

    // =========================================================================
    // 1. Authorization: Quyền report.view
    // =========================================================================
    [Theory]
    [InlineData("report.view", true)]
    [InlineData("job.view", false)]
    [InlineData("affiliate.performance.view_own", false)]
    [InlineData("placement.confirm", false)]
    public void ReportEndpoints_RequireReportViewPermission(string permission, bool shouldBeAllowed)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("permission", permission)], "test"));
        PermissionAuthorization.HasPermission(principal, "report.view").Should().Be(shouldBeAllowed);
    }

    [Fact]
    public void ReportEndpoints_UnauthenticatedOrNoClaims_DeniesAccess()
    {
        var unauthenticated = new ClaimsPrincipal(new ClaimsIdentity());
        PermissionAuthorization.HasPermission(unauthenticated, "report.view").Should().BeFalse();
    }

    // =========================================================================
    // 2. Nghiệm thu 2: Seed 2 job khác dịch vụ + 1 phí PAID -> overview và revenue khớp
    // =========================================================================
    [Fact]
    public async Task Overview_And_Revenue_Match_Manually_Counted_Data()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now.AddHours(7));

        var headhuntServiceType = new ServiceType
        {
            ServiceTypeId = Guid.NewGuid(),
            Code = "HEADHUNT_COD",
            Name = "Headhunt COD",
            IsActive = true
        };
        var cvAppServiceType = new ServiceType
        {
            ServiceTypeId = Guid.NewGuid(),
            Code = "CV_APPLICATION",
            Name = "CV Application",
            IsActive = true
        };
        await _context.ServiceTypes.AddRangeAsync(headhuntServiceType, cvAppServiceType);

        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "FPT Software",
            VerificationStatus = "VERIFIED",
            VerifiedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        await _context.Companies.AddAsync(company);

        var job1 = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            ServiceTypeId = headhuntServiceType.ServiceTypeId,
            ServiceType = headhuntServiceType,
            Title = "Senior C# Backend Engineer",
            Status = "ACTIVE",
            CurrencyCode = "VND",
            Quantity = 2,
            CreatedAt = now,
            UpdatedAt = now
        };
        var job2 = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            ServiceTypeId = cvAppServiceType.ServiceTypeId,
            ServiceType = cvAppServiceType,
            Title = "React Frontend Developer",
            Status = "PENDING_REVIEW",
            CurrencyCode = "VND",
            Quantity = 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        await _context.Jobs.AddRangeAsync(job1, job2);

        // 1 phí PAID cho HEADHUNT_COD
        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(),
            ApplicationId = Guid.NewGuid(),
            OfferId = Guid.NewGuid(),
            ActualStartDate = today,
            Status = PlacementStates.Started,
            ConfirmedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        var serviceFee = new ServiceFee
        {
            ServiceFeeId = Guid.NewGuid(),
            PlacementId = placement.PlacementId,
            Placement = placement,
            Amount = 30_000_000m,
            CurrencyCode = "VND",
            Status = ServiceFeeStates.Paid,
            PaidAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        await _context.Placements.AddAsync(placement);
        await _context.ServiceFees.AddAsync(serviceFee);
        await _context.SaveChangesAsync();

        // 1. Kiểm tra Overview
        var overviewHandler = new GetReportOverviewQueryHandler(Repository);
        var overview = await overviewHandler.Handle(new GetReportOverviewQuery(today.AddDays(-1), today.AddDays(1)), default);

        overview.Jobs.ByStatus["ACTIVE"].Should().Be(1);
        overview.Jobs.ByStatus["PENDING_REVIEW"].Should().Be(1);
        overview.Jobs.ByServiceType["HEADHUNT_COD"].Should().Be(1);
        overview.Jobs.ByServiceType["CV_APPLICATION"].Should().Be(1);
        overview.Jobs.ByServiceType["CV_SOURCING"].Should().Be(0);
        overview.Placements.Started.Should().Be(1);
        overview.Companies.Verified.Should().Be(1);

        // 2. Kiểm tra Revenue
        var revenueHandler = new GetReportRevenueQueryHandler(Repository);
        var revenue = await revenueHandler.Handle(new GetReportRevenueQuery(today.AddDays(-1), today.AddDays(1), "MONTH"), default);

        revenue.Currency.Should().Be("VND");
        revenue.Totals["HEADHUNT_COD"].Collected.Should().Be(30_000_000m);
        revenue.Totals["HEADHUNT_COD"].Billed.Should().Be(30_000_000m);
        revenue.Totals["CV_APPLICATION"].Collected.Should().Be(0m);
        revenue.Totals["CV_SOURCING"].Collected.Should().Be(0m);
        revenue.Series.Should().HaveCount(1);
        revenue.Series[0].HEADHUNT_COD.Should().Be(30_000_000m);
    }

    // =========================================================================
    // 3. Nghiệm thu 3: Kỳ không có dữ liệu -> các số là 0, items rỗng, không lỗi
    // =========================================================================
    [Fact]
    public async Task Empty_Period_Returns_Zeroes_And_Empty_Collections_Without_Error()
    {
        var futureFrom = new DateOnly(2035, 1, 1);
        var futureTo = new DateOnly(2035, 12, 31);

        var overviewHandler = new GetReportOverviewQueryHandler(Repository);
        var overview = await overviewHandler.Handle(new GetReportOverviewQuery(futureFrom, futureTo), default);
        overview.Applications.Submitted.Should().Be(0);
        overview.Applications.Shortlisted.Should().Be(0);
        overview.Applications.Interview.Should().Be(0);
        overview.Applications.Placed.Should().Be(0);
        overview.Placements.Started.Should().Be(0);
        overview.Placements.WarrantyPassed.Should().Be(0);
        overview.Placements.WarrantyVoided.Should().Be(0);

        var revenueHandler = new GetReportRevenueQueryHandler(Repository);
        var revenue = await revenueHandler.Handle(new GetReportRevenueQuery(futureFrom, futureTo, "QUARTER"), default);
        revenue.Totals["HEADHUNT_COD"].Billed.Should().Be(0m);
        revenue.Totals["HEADHUNT_COD"].Collected.Should().Be(0m);
        revenue.Series.Should().BeEmpty();
        revenue.Commission.Earned.Should().Be(0m);
        revenue.Commission.Paid.Should().Be(0m);

        var topAffiliatesHandler = new GetReportTopAffiliatesQueryHandler(Repository, Settings);
        var topAffiliates = await topAffiliatesHandler.Handle(new GetReportTopAffiliatesQuery(futureFrom, futureTo, "PLACEMENTS", 10), default);
        topAffiliates.Items.Should().BeEmpty();

        var topCompaniesHandler = new GetReportTopCompaniesQueryHandler(Repository);
        var topCompanies = await topCompaniesHandler.Handle(new GetReportTopCompaniesQuery(futureFrom, futureTo, "PLACEMENTS", 10), default);
        topCompanies.Items.Should().BeEmpty();
    }

    // =========================================================================
    // 4. Test Rating Calculator theo ví dụ B1
    // =========================================================================
    [Fact]
    public void AffiliateRatingCalculator_Follows_Doc_Examples_Accurately()
    {
        var config = new AffiliateRatingConfig(
            WeightHire: 0.7m,
            WeightShortlist: 0.3m,
            HireRateTarget: 0.20m,
            MinSubmissions: 5,
            ExcellentMin: 4.0m,
            GoodMin: 3.0m,
            AverageMin: 2.0m);

        // Ví dụ 1: 10 lượt, 4 qua sàng lọc, 2 tuyển được -> hire 0.2, shortlist 0.4 -> 4.1 -> EXCELLENT
        var res1 = AffiliateRatingCalculator.Calculate(10, 4, 2, config);
        res1.SubmissionToHireRate.Should().Be(0.2m);
        res1.QualityRating.Should().Be(4.1m);
        res1.RatingLabel.Should().Be("EXCELLENT");

        // Ví dụ 2: 10 lượt, 2 qua sàng lọc, 0 tuyển -> hire 0, shortlist 0.2 -> 0.3 -> LOW
        var res2 = AffiliateRatingCalculator.Calculate(10, 2, 0, config);
        res2.SubmissionToHireRate.Should().Be(0m);
        res2.QualityRating.Should().Be(0.3m);
        res2.RatingLabel.Should().Be("LOW");

        // Dưới số lượt tối thiểu (3 < 5) -> NEW, QualityRating = null
        var res3 = AffiliateRatingCalculator.Calculate(3, 2, 1, config);
        res3.QualityRating.Should().BeNull();
        res3.RatingLabel.Should().Be("NEW");
    }

    // =========================================================================
    // 5. Test Top Affiliates Report: Sắp xếp và điều kiện min_submissions
    // =========================================================================
    [Fact]
    public async Task TopAffiliates_Filters_By_Min_Submissions_When_Sorted_By_ConversionRate()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now.AddHours(7));

        var user1 = new AppUser { UserId = Guid.NewGuid(), Email = "aff1@test.com", DisplayName = "Affiliate One", PasswordHash = "x", Status = "ACTIVE" };
        var user2 = new AppUser { UserId = Guid.NewGuid(), Email = "aff2@test.com", DisplayName = "Affiliate Two", PasswordHash = "x", Status = "ACTIVE" };
        await _context.AppUsers.AddRangeAsync(user1, user2);

        var profile1 = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user1.UserId, DisplayName = "Affiliate One", Status = "ACTIVE", AffiliateType = "INDIVIDUAL" };
        var profile2 = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user2.UserId, DisplayName = "Affiliate Two", Status = "ACTIVE", AffiliateType = "INDIVIDUAL" };
        await _context.AffiliateProfiles.AddRangeAsync(profile1, profile2);

        // User1 có 1/1 = 100% nhưng < min_submissions (5)
        var candidate1 = new Candidate { CandidateId = Guid.NewGuid(), FullName = "C1", Status = "ACTIVE", Email = "c1@test.com", ProfileVisibility = "PUBLIC" };
        await _context.Candidates.AddAsync(candidate1);
        var sub1 = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            SubmittedBy = user1.UserId,
            CandidateId = candidate1.CandidateId,
            CvId = Guid.NewGuid(),
            JobId = Guid.NewGuid(),
            Source = "DIRECT",
            Status = "ACCEPTED",
            SubmittedAt = now,
            UpdatedAt = now
        };
        var app1 = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            JobId = sub1.JobId,
            CandidateId = candidate1.CandidateId,
            AcceptedSubmissionId = sub1.SubmissionId,
            Status = ApplicationStates.Placed,
            AppliedAt = now,
            UpdatedAt = now
        };
        var placement1 = new Placement
        {
            PlacementId = Guid.NewGuid(),
            ApplicationId = app1.ApplicationId,
            OfferId = Guid.NewGuid(),
            ActualStartDate = today,
            Status = PlacementStates.Started,
            ConfirmedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        app1.Placement = placement1;
        sub1.Applications.Add(app1);
        await _context.Submissions.AddAsync(sub1);
        await _context.Applications.AddAsync(app1);
        await _context.Placements.AddAsync(placement1);

        // User2 có 10 submissions (>= 5), 2 placement = 20%
        for (int i = 0; i < 10; i++)
        {
            var cand = new Candidate { CandidateId = Guid.NewGuid(), FullName = $"C2_{i}", Status = "ACTIVE", Email = $"c2_{i}@test.com", ProfileVisibility = "PUBLIC" };
            await _context.Candidates.AddAsync(cand);
            var sub = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                SubmittedBy = user2.UserId,
                CandidateId = cand.CandidateId,
                CvId = Guid.NewGuid(),
                JobId = Guid.NewGuid(),
                Source = "DIRECT",
                Status = "ACCEPTED",
                SubmittedAt = now,
                UpdatedAt = now
            };
            var app = new JobApplication
            {
                ApplicationId = Guid.NewGuid(),
                JobId = sub.JobId,
                CandidateId = cand.CandidateId,
                AcceptedSubmissionId = sub.SubmissionId,
                Status = i < 2 ? ApplicationStates.Placed : ApplicationStates.Shortlisted,
                AppliedAt = now,
                UpdatedAt = now
            };
            if (i < 2)
            {
                var p = new Placement
                {
                    PlacementId = Guid.NewGuid(),
                    ApplicationId = app.ApplicationId,
                    OfferId = Guid.NewGuid(),
                    ActualStartDate = today,
                    Status = PlacementStates.Started,
                    ConfirmedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                app.Placement = p;
                await _context.Placements.AddAsync(p);
            }
            sub.Applications.Add(app);
            await _context.Submissions.AddAsync(sub);
            await _context.Applications.AddAsync(app);
        }
        await _context.SaveChangesAsync();

        var handler = new GetReportTopAffiliatesQueryHandler(Repository, Settings);

        // Khi sort theo SUBMISSION_TO_HIRE_RATE: User1 (1 lượt) bị loại vì < 5; User2 được xếp hạng
        var resRate = await handler.Handle(new GetReportTopAffiliatesQuery(today.AddDays(-1), today.AddDays(1), "SUBMISSION_TO_HIRE_RATE", 10), default);
        resRate.Items.Should().HaveCount(1);
        resRate.Items[0].AffiliateId.Should().Be(profile2.AffiliateId);

        // Khi sort theo PLACEMENTS: User2 (2 placements) đứng đầu, User1 (1 placement) đứng nhì
        var resPlacements = await handler.Handle(new GetReportTopAffiliatesQuery(today.AddDays(-1), today.AddDays(1), "PLACEMENTS", 10), default);
        resPlacements.Items.Should().HaveCount(2);
        resPlacements.Items[0].AffiliateId.Should().Be(profile2.AffiliateId);
        resPlacements.Items[1].AffiliateId.Should().Be(profile1.AffiliateId);
    }

    // =========================================================================
    // 6. Test Top Companies Report
    // =========================================================================
    [Fact]
    public async Task TopCompanies_Sorts_Correctly_By_Revenue_And_ActiveJobs()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now.AddHours(7));

        var c1 = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Company A", Industry = "IT", VerificationStatus = "VERIFIED", CreatedAt = now, UpdatedAt = now };
        var c2 = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Company B", Industry = "Finance", VerificationStatus = "VERIFIED", CreatedAt = now, UpdatedAt = now };
        await _context.Companies.AddRangeAsync(c1, c2);

        // C1 có 3 active jobs, 0 revenue
        for (int i = 0; i < 3; i++)
        {
            await _context.Jobs.AddAsync(new Job
            {
                JobId = Guid.NewGuid(), CompanyId = c1.CompanyId, ServiceTypeId = Guid.NewGuid(), Title = $"Job A {i}", Status = "ACTIVE",
                CurrencyCode = "VND", Quantity = 1, CreatedAt = now, UpdatedAt = now
            });
        }

        // C2 có 1 job, 1 service fee PAID 50M
        var jobC2 = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = c2.CompanyId, ServiceTypeId = Guid.NewGuid(), Title = "Job B", Status = "ACTIVE",
            CurrencyCode = "VND", Quantity = 1, CreatedAt = now, UpdatedAt = now
        };
        var appC2 = new JobApplication { ApplicationId = Guid.NewGuid(), JobId = jobC2.JobId, CandidateId = Guid.NewGuid(), Status = ApplicationStates.Placed, AppliedAt = now, UpdatedAt = now };
        var placementC2 = new Placement { PlacementId = Guid.NewGuid(), ApplicationId = appC2.ApplicationId, OfferId = Guid.NewGuid(), ActualStartDate = today, Status = PlacementStates.Started, ConfirmedAt = now, CreatedAt = now, UpdatedAt = now };
        var feeC2 = new ServiceFee { ServiceFeeId = Guid.NewGuid(), PlacementId = placementC2.PlacementId, Amount = 50_000_000m, CurrencyCode = "VND", Status = ServiceFeeStates.Paid, PaidAt = now, CreatedAt = now, UpdatedAt = now };
        appC2.Placement = placementC2;
        feeC2.Placement = placementC2;
        placementC2.Application = appC2;
        await _context.Jobs.AddAsync(jobC2);
        await _context.Applications.AddAsync(appC2);
        await _context.Placements.AddAsync(placementC2);
        await _context.ServiceFees.AddAsync(feeC2);
        await _context.SaveChangesAsync();

        var handler = new GetReportTopCompaniesQueryHandler(Repository);

        // Sắp xếp theo REVENUE -> C2 đứng đầu
        var resRev = await handler.Handle(new GetReportTopCompaniesQuery(today.AddDays(-1), today.AddDays(1), "REVENUE", 10), default);
        resRev.Items[0].CompanyId.Should().Be(c2.CompanyId);
        resRev.Items[0].RevenueCollected.Should().Be(50_000_000m);

        // Sắp xếp theo ACTIVE_JOBS -> C1 đứng đầu (3 jobs vs 1 job)
        var resJobs = await handler.Handle(new GetReportTopCompaniesQuery(today.AddDays(-1), today.AddDays(1), "ACTIVE_JOBS", 10), default);
        resJobs.Items[0].CompanyId.Should().Be(c1.CompanyId);
        resJobs.Items[0].ActiveJobs.Should().Be(3);
    }

    // =========================================================================
    // 7. Validation: Ngày bắt đầu > ngày kết thúc hoặc tham số sai
    // =========================================================================
    [Fact]
    public async Task Invalid_Parameters_Throw_BadRequestException()
    {
        var overviewHandler = new GetReportOverviewQueryHandler(Repository);
        await overviewHandler
            .Invoking(h => h.Handle(new GetReportOverviewQuery(new DateOnly(2026, 12, 31), new DateOnly(2026, 1, 1)), default))
            .Should().ThrowAsync<BadRequestException>();

        var revenueHandler = new GetReportRevenueQueryHandler(Repository);
        await revenueHandler
            .Invoking(h => h.Handle(new GetReportRevenueQuery(null, null, "INVALID_GROUP"), default))
            .Should().ThrowAsync<BadRequestException>();

        var topAffiliatesHandler = new GetReportTopAffiliatesQueryHandler(Repository, Settings);
        await topAffiliatesHandler
            .Invoking(h => h.Handle(new GetReportTopAffiliatesQuery(null, null, "INVALID_SORT", 10), default))
            .Should().ThrowAsync<BadRequestException>();

        var topCompaniesHandler = new GetReportTopCompaniesQueryHandler(Repository);
        await topCompaniesHandler
            .Invoking(h => h.Handle(new GetReportTopCompaniesQuery(null, null, "INVALID_SORT", 10), default))
            .Should().ThrowAsync<BadRequestException>();
    }
}
