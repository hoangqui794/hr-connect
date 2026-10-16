using FluentAssertions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;

namespace HRConnect.UnitTests.Features.Jobs.Common;

/// <summary>
/// Job access is decided by role permissions (service_type_allowed_role can_view / can_submit),
/// checked in the handlers through the repository. The policy only covers status, ownership and
/// which actor an operation runs as.
/// </summary>
public sealed class JobAccessPolicyTests
{
    [Theory]
    [InlineData(JobStatuses.Active, false, false, true)]
    [InlineData(JobStatuses.Paused, false, false, false)]
    [InlineData(JobStatuses.Draft, false, false, false)]
    [InlineData(JobStatuses.Paused, true, false, true)]
    [InlineData(JobStatuses.Draft, false, true, true)]
    public void CanViewDetail_ShouldAllowActiveJobsOrOwnerOrInternal(
        string status, bool isOwner, bool hasInternalAccess, bool expected)
    {
        var job = CreateJob(status);

        JobAccessPolicy.CanViewDetail(job, isOwner, hasInternalAccess).Should().Be(expected);
    }

    [Theory]
    [InlineData(JobStatuses.Active, true)]
    [InlineData(JobStatuses.Paused, false)]
    public void CanCandidateApply_ShouldRequireCandidateRoleAndOpenJob(string status, bool expected)
    {
        var job = CreateJob(status);

        JobAccessPolicy.CanCandidateApply(job, ["candidate"]).Should().Be(expected);
    }

    [Fact]
    public void CanCandidateApply_ShouldNotEscalateAffiliateOnlyOrNullRoles()
    {
        var job = CreateJob();

        JobAccessPolicy.CanCandidateApply(job, [JobAccessPolicy.AffiliateRole]).Should().BeFalse();
        JobAccessPolicy.CanCandidateApply(job, null!).Should().BeFalse();
    }

    [Fact]
    public void CanCandidateApply_ShouldRejectPassedDeadline()
    {
        var job = CreateJob();
        job.ApplicationDeadline = DateTime.UtcNow.AddMinutes(-1);

        JobAccessPolicy.CanCandidateApply(job, [JobAccessPolicy.CandidateRole]).Should().BeFalse();
    }

    [Theory]
    [InlineData(JobStatuses.Active, JobAccessPolicy.AffiliateRole, true)]
    [InlineData(JobStatuses.Active, "affiliate_recruiter", true)]
    [InlineData(JobStatuses.Active, "HEADHUNTER", false)]
    [InlineData(JobStatuses.Paused, JobAccessPolicy.AffiliateRole, false)]
    [InlineData(JobStatuses.Active, JobAccessPolicy.CandidateRole, false)]
    public void CanAffiliateSubmit_ShouldRequireAffiliateRoleAndOpenJob(string status, string role, bool expected)
    {
        var job = CreateJob(status);

        JobAccessPolicy.CanAffiliateSubmit(job, [role]).Should().Be(expected);
    }

    [Fact]
    public void CanAffiliateSubmit_ShouldRejectNullRoles()
    {
        JobAccessPolicy.CanAffiliateSubmit(CreateJob(), null!).Should().BeFalse();
    }

    [Fact]
    public void CanManageJob_ShouldOnlyAllowOwningCompany()
    {
        var companyId = Guid.NewGuid();
        var job = CreateJob();
        job.CompanyId = companyId;

        JobAccessPolicy.CanManageJob(job, companyId).Should().BeTrue();
        JobAccessPolicy.CanManageJob(job, Guid.NewGuid()).Should().BeFalse();
    }

    private static Job CreateJob(string status = JobStatuses.Active) => new()
    {
        JobId = Guid.NewGuid(),
        CompanyId = Guid.NewGuid(),
        ServiceTypeId = Guid.NewGuid(),
        CreatedBy = Guid.NewGuid(),
        Status = status,
        CurrencyCode = "VND",
        Quantity = 1,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
