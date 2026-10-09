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
                It.Is<IReadOnlyCollection<string>>(visibilities =>
                    visibilities.Contains(JobVisibilities.Public) &&
                    visibilities.Contains(JobVisibilities.PartnerOnly)),
                false, "dotnet", null, null, null, null, null, 1, 20,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([visibleJob], 1));

        var result = await new GetPublicJobsQueryHandler(_jobs.Object).Handle(
            new GetPublicJobsQuery(["CANDIDATE", "AFFILIATE_RECRUITER"], false, "dotnet", null, null), default);

        result.Items.Should().ContainSingle();
        result.TotalCount.Should().Be(1);
        result.TotalPages.Should().Be(1);
    }

    [Theory]
    [InlineData(JobVisibilities.Public, "CANDIDATE", true)]
    [InlineData(JobVisibilities.Public, "AFFILIATE_RECRUITER", true)]
    [InlineData(JobVisibilities.PartnerOnly, "AFFILIATE_RECRUITER", true)]
    [InlineData(JobVisibilities.PartnerOnly, "HEADHUNTER", false)]
    [InlineData(JobVisibilities.PartnerOnly, "CANDIDATE", false)]
    [InlineData(JobVisibilities.InternalOnly, "AFFILIATE_RECRUITER", false)]
    public async Task GetDetail_ShouldEnforceVisibilityAndServiceType(
        string visibility, string role, bool expectedAllowed)
    {
        var job = Job(Guid.NewGuid(), JobStatuses.Active);
        job.Visibility = visibility;
        var user = Guid.NewGuid();
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);
        _jobs.Setup(x => x.CanAnyRoleViewJobAsync(job.ServiceTypeId,
            It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var action = () => new GetJobDetailQueryHandler(_jobs.Object, _members.Object)
            .Handle(new GetJobDetailQuery(job.JobId, user, false, [role]), default);

        if (expectedAllowed)
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

    private static CompanyUser Member(Guid user, Guid company) => new() { CompanyUserId = Guid.NewGuid(), UserId = user, CompanyId = company, Status = "ACTIVE" };
    private static Job Job(Guid company, string status) => new() { JobId = Guid.NewGuid(), CompanyId = company, ServiceTypeId = Guid.NewGuid(), CreatedBy = Guid.NewGuid(), Title = "Job", Benefits = "Insurance and training", CurrencyCode = "VND", Quantity = 1, Status = status, Visibility = "PUBLIC", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
}
