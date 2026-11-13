using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Queries.GetJobDetail;
using HRConnect.Application.Features.Jobs.Queries.GetJobsForReview;
using HRConnect.Application.Features.Jobs.Queries.GetMyJobs;
using HRConnect.Application.Features.Jobs.Queries.GetPublicJobs;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Jobs;

public class JobManagementQueryHandlerTests
{
    private readonly Mock<IJobRepository> _jobs = new(); private readonly Mock<ICompanyUserRepository> _members = new();

    [Fact]
    public async Task GetMyJobs_ShouldReturnOnlyRequestedStatusForCompany()
    {
        var user = Guid.NewGuid(); var company = Guid.NewGuid();
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(Member(user, company));
        _jobs.Setup(x => x.GetByCompanyIdAsync(company, It.IsAny<CancellationToken>())).ReturnsAsync([Job(company, "DRAFT"), Job(company, "ACTIVE")]);
        var result = await new GetMyJobsQueryHandler(_jobs.Object, _members.Object).Handle(new GetMyJobsQuery(user, "ACTIVE"), default);
        result.Should().ContainSingle().Which.Status.Should().Be("ACTIVE");
    }

    [Fact]
    public async Task GetMyJobs_ShouldPopulateSourcingCountedForCvSourcingJobs()
    {
        var user = Guid.NewGuid();
        var company = Guid.NewGuid();
        var sourcingJob = Job(company, "ACTIVE");
        sourcingJob.ServiceType = new ServiceType { ServiceTypeId = sourcingJob.ServiceTypeId, Code = "CV_SOURCING", Name = "CV Sourcing" };
        sourcingJob.SourcingTarget = 10;
        var headhuntJob = Job(company, "ACTIVE");
        headhuntJob.ServiceType = new ServiceType { ServiceTypeId = headhuntJob.ServiceTypeId, Code = "HEADHUNT_COD", Name = "Headhunt" };

        var sourcingDeliveries = new Mock<ISourcingDeliveryRepository>();
        sourcingDeliveries
            .Setup(x => x.GetCountedCountsByJobIdsAsync(
                It.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1 && ids.Contains(sourcingJob.JobId)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int> { [sourcingJob.JobId] = 4 });

        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(Member(user, company));
        _jobs.Setup(x => x.GetByCompanyIdAsync(company, It.IsAny<CancellationToken>())).ReturnsAsync([sourcingJob, headhuntJob]);

        var result = await new GetMyJobsQueryHandler(_jobs.Object, _members.Object, sourcingDeliveries.Object)
            .Handle(new GetMyJobsQuery(user, null), default);

        result.Single(j => j.JobId == sourcingJob.JobId).SourcingCounted.Should().Be(4);
        result.Single(j => j.JobId == headhuntJob.JobId).SourcingCounted.Should().BeNull();
    }

    [Fact]
    public async Task GetDetail_ShouldAllowReviewerAndRejectDifferentCompanyClient()
    {
        var job = Job(Guid.NewGuid(), "PENDING_REVIEW"); var user = Guid.NewGuid();
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        var handler = new GetJobDetailQueryHandler(_jobs.Object, _members.Object);
        (await handler.Handle(new GetJobDetailQuery(job.JobId, user, true, []), default)).JobId.Should().Be(job.JobId);
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(Member(user, Guid.NewGuid()));
        var action = () => handler.Handle(new GetJobDetailQuery(job.JobId, user, false, []), default);
        await action.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task GetDetail_ShouldAllowExternalRole_WhenJobIsActivePublicAndMappingAllowsView()
    {
        var job = Job(Guid.NewGuid(), JobStatuses.Active);
        var user = Guid.NewGuid();
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);
        _jobs.Setup(x => x.CanAnyRoleViewJobAsync(job.ServiceTypeId,
            It.Is<IReadOnlyCollection<string>>(roles => roles.Contains("CANDIDATE")), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await new GetJobDetailQueryHandler(_jobs.Object, _members.Object)
            .Handle(new GetJobDetailQuery(job.JobId, user, false, ["CANDIDATE"]), default);

        result.JobId.Should().Be(job.JobId);
        result.Benefits.Should().Be(job.Benefits);
        result.StatusHistories.Should().BeEmpty();
    }

    [Fact]
    public async Task GetDetail_ShouldRejectExternalRole_WhenJobIsNotActive()
    {
        var job = Job(Guid.NewGuid(), JobStatuses.Paused);
        var user = Guid.NewGuid();
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);

        var action = () => new GetJobDetailQueryHandler(_jobs.Object, _members.Object)
            .Handle(new GetJobDetailQuery(job.JobId, user, false, ["CANDIDATE"]), default);

        await action.Should().ThrowAsync<ForbiddenException>();
        _jobs.Verify(x => x.CanAnyRoleViewJobAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetPublicJobs_ShouldPassAllRolesAndReturnPagination()
    {
        var visibleJob = Job(Guid.NewGuid(), JobStatuses.Active);
        _jobs.Setup(x => x.GetVisibleJobsAsync(
                It.Is<IReadOnlyCollection<string>>(roles => roles.Count == 2),
                false, "dotnet", null, null, null, null, null, 1, 20,
                null, null,
                It.IsAny<CancellationToken>(),
                It.IsAny<Guid?>()))
            .ReturnsAsync(([visibleJob], 1));

        var result = await new GetPublicJobsQueryHandler(_jobs.Object).Handle(
            new GetPublicJobsQuery(["CANDIDATE", "AFFILIATE"], false, "dotnet", null, null), default);

        result.Items.Should().ContainSingle();
        result.TotalCount.Should().Be(1);
        result.TotalPages.Should().Be(1);
    }

    [Fact]
    public async Task GetPublicJobs_ShouldApplyCandidateScopeForGuestCatalog()
    {
        var visibleJob = Job(Guid.NewGuid(), JobStatuses.Active);
        _jobs.Setup(x => x.GetVisibleJobsAsync(
                It.Is<IReadOnlyCollection<string>>(roles =>
                    roles.Count == 1 && roles.Contains(JobAccessPolicy.CandidateRole)),
                false, null, null, null, null, null, null, 1, 12,
                null, null,
                It.IsAny<CancellationToken>(),
                It.IsAny<Guid?>()))
            .ReturnsAsync(([visibleJob], 1));

        var result = await new GetPublicJobsQueryHandler(_jobs.Object).Handle(
            new GetPublicJobsQuery([JobAccessPolicy.CandidateRole], false, null, null, null, Page: 1, PageSize: 12),
            default);

        result.Items.Should().ContainSingle().Which.JobId.Should().Be(visibleJob.JobId);
        _jobs.VerifyAll();
    }

    [Theory]
    [InlineData("CANDIDATE", true)]
    [InlineData("AFFILIATE", true)]
    [InlineData("CANDIDATE", false)]
    [InlineData("HEADHUNTER", false)]
    public async Task GetDetail_ShouldFollowRoleCanViewPermission(string role, bool canView)
    {
        var job = Job(Guid.NewGuid(), JobStatuses.Active);
        var user = Guid.NewGuid();
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);
        _jobs.Setup(x => x.CanAnyRoleViewJobAsync(job.ServiceTypeId,
            It.Is<IReadOnlyCollection<string>>(roles => roles.Contains(role)), It.IsAny<CancellationToken>())).ReturnsAsync(canView);

        var action = () => new GetJobDetailQueryHandler(_jobs.Object, _members.Object)
            .Handle(new GetJobDetailQuery(job.JobId, user, false, [role]), default);

        if (canView)
            (await action()).JobId.Should().Be(job.JobId);
        else
            await action.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task GetJobsForReview_ShouldMapPendingQueue()
    {
        var pending = Job(Guid.NewGuid(), "PENDING_REVIEW");
        _jobs.Setup(x => x.GetForReviewAsync("PENDING_REVIEW", It.IsAny<CancellationToken>())).ReturnsAsync([pending]);
        var result = await new GetJobsForReviewQueryHandler(_jobs.Object).Handle(new GetJobsForReviewQuery(), default);
        result.Should().ContainSingle().Which.JobId.Should().Be(pending.JobId);
    }

    [Fact]
    public async Task GetJobsForReview_ShouldExcludeDraftJobsWhenStatusIsAll()
    {
        var draft = Job(Guid.NewGuid(), JobStatuses.Draft);
        var pending = Job(Guid.NewGuid(), JobStatuses.PendingReview);
        _jobs.Setup(x => x.GetForReviewAsync("ALL", It.IsAny<CancellationToken>())).ReturnsAsync([draft, pending]);
        var result = await new GetJobsForReviewQueryHandler(_jobs.Object).Handle(new GetJobsForReviewQuery("ALL"), default);
        result.Should().ContainSingle().Which.JobId.Should().Be(pending.JobId);
    }

    [Fact]
    public async Task GetJobsForReview_ShouldPopulateSourcingCountedForCvSourcingJobs()
    {
        var active = Job(Guid.NewGuid(), JobStatuses.Active);
        active.ServiceType = new ServiceType { ServiceTypeId = active.ServiceTypeId, Code = "CV_SOURCING", Name = "CV Sourcing" };
        active.SourcingTarget = 20;

        var sourcingDeliveries = new Mock<ISourcingDeliveryRepository>();
        sourcingDeliveries
            .Setup(x => x.GetCountedCountsByJobIdsAsync(
                It.Is<IReadOnlyCollection<Guid>>(ids => ids.Contains(active.JobId)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int> { [active.JobId] = 7 });

        _jobs.Setup(x => x.GetForReviewAsync("ACTIVE", It.IsAny<CancellationToken>())).ReturnsAsync([active]);
        var result = await new GetJobsForReviewQueryHandler(_jobs.Object, sourcingDeliveries.Object)
            .Handle(new GetJobsForReviewQuery("ACTIVE"), default);

        result.Should().ContainSingle().Which.SourcingCounted.Should().Be(7);
    }

    [Fact]
    public async Task GetDetail_ShouldPopulateSourcingCountedForAuthorizedRolesOnly()
    {
        var job = Job(Guid.NewGuid(), JobStatuses.Active);
        job.ServiceType = new ServiceType { ServiceTypeId = job.ServiceTypeId, Code = "CV_SOURCING", Name = "CV Sourcing" };
        job.SourcingTarget = 15;
        var user = Guid.NewGuid();

        var sourcingDeliveries = new Mock<ISourcingDeliveryRepository>();
        sourcingDeliveries
            .Setup(x => x.GetCountedCountsByJobIdsAsync(
                It.Is<IReadOnlyCollection<Guid>>(ids => ids.Contains(job.JobId)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int> { [job.JobId] = 5 });

        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);
        _jobs.Setup(x => x.CanAnyRoleViewJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var handler = new GetJobDetailQueryHandler(_jobs.Object, _members.Object, sourcingDeliveries: sourcingDeliveries.Object);

        var affiliateDetail = await handler.Handle(new GetJobDetailQuery(job.JobId, user, false, ["AFFILIATE"]), default);
        affiliateDetail.SourcingCounted.Should().Be(5);

        var candidateDetail = await handler.Handle(new GetJobDetailQuery(job.JobId, user, false, ["CANDIDATE"]), default);
        candidateDetail.SourcingCounted.Should().BeNull();
    }

    [Fact]
    public async Task GetMyJobs_ShouldReturnTheIssuedDepositAmountAndOpenDueDate()
    {
        var user = Guid.NewGuid();
        var company = Guid.NewGuid();
        Job Sourcing()
        {
            var job = Job(company, "PENDING_PAYMENT");
            job.ServiceType = new ServiceType { ServiceTypeId = job.ServiceTypeId, Code = "CV_SOURCING", Name = "CV Sourcing" };
            return job;
        }
        var unpaid = Sourcing();
        var paid = Sourcing();
        var noFeeYet = Sourcing();
        var due = new DateOnly(2026, 11, 20);

        var finance = new Mock<IFinanceRepository>();
        finance.Setup(x => x.GetJobServiceFeesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ServiceFee>
            {
                new() { JobId = unpaid.JobId, Kind = "DEPOSIT", Status = "PENDING", Amount = 3_000_000m, DueDate = due, CreatedAt = DateTime.UtcNow },
                new() { JobId = unpaid.JobId, Kind = "DEPOSIT", Status = "CANCELLED", Amount = 9_999_999m, DueDate = due, CreatedAt = DateTime.UtcNow.AddDays(1) },
                new() { JobId = paid.JobId, Kind = "DEPOSIT", Status = "PAID", Amount = 2_000_000m, DueDate = due, CreatedAt = DateTime.UtcNow },
                new() { JobId = paid.JobId, Kind = "SETTLEMENT", Status = "PENDING", Amount = 5_000_000m, DueDate = due, CreatedAt = DateTime.UtcNow },
            });
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(Member(user, company));
        _jobs.Setup(x => x.GetByCompanyIdAsync(company, It.IsAny<CancellationToken>())).ReturnsAsync([unpaid, paid, noFeeYet]);

        var result = await new GetMyJobsQueryHandler(_jobs.Object, _members.Object, null, finance.Object)
            .Handle(new GetMyJobsQuery(user, null), default);

        var u = result.Single(j => j.JobId == unpaid.JobId);
        u.DepositAmount.Should().Be(3_000_000m, "a cancelled deposit is ignored");
        u.PaymentDueAt.Should().Be(due);
        var p = result.Single(j => j.JobId == paid.JobId);
        p.DepositAmount.Should().Be(2_000_000m);
        p.PaymentDueAt.Should().BeNull("a paid deposit has nothing due");
        var n = result.Single(j => j.JobId == noFeeYet.JobId);
        n.DepositAmount.Should().BeNull();
        n.PaymentDueAt.Should().BeNull();
    }

    private static CompanyUser Member(Guid user, Guid company) => new() { CompanyUserId = Guid.NewGuid(), UserId = user, CompanyId = company, Status = "ACTIVE" };
    private static Job Job(Guid company, string status) => new() { JobId = Guid.NewGuid(), CompanyId = company, ServiceTypeId = Guid.NewGuid(), CreatedBy = Guid.NewGuid(), Title = "Job", Benefits = "Insurance and training", CurrencyCode = "VND", Quantity = 1, Status = status, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
}
