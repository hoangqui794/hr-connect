using FluentAssertions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;

namespace HRConnect.UnitTests.Features.Jobs.Common;

public sealed class JobAccessPolicyTests
{
    [Fact]
    public void GetDiscoverableVisibilities_ShouldReturnAll_ForInternalAccess()
    {
        var result = JobAccessPolicy.GetDiscoverableVisibilities([], hasInternalAccess: true);

        result.Should().BeEquivalentTo(JobVisibilities.All);
    }

    [Theory]
    [InlineData(JobAccessPolicy.AffiliateRole)]
    [InlineData("affiliate_recruiter")]
    public void GetDiscoverableVisibilities_ShouldIncludePartnerOnly_ForPartnerRole(string role)
    {
        var result = JobAccessPolicy.GetDiscoverableVisibilities([role], hasInternalAccess: false);

        result.Should().BeEquivalentTo([JobVisibilities.Public, JobVisibilities.PartnerOnly]);
    }

    [Fact]
    public void GetDiscoverableVisibilities_ShouldReturnPublicOnly_ForNullRoles()
    {
        var result = JobAccessPolicy.GetDiscoverableVisibilities(null!, hasInternalAccess: false);

        result.Should().Equal(JobVisibilities.Public);
    }

    [Theory]
    [InlineData(JobVisibilities.Public, JobStatuses.Active, false, false, JobAccessPolicy.CandidateRole, true)]
    [InlineData(JobVisibilities.PartnerOnly, JobStatuses.Active, false, false, JobAccessPolicy.AffiliateRole, true)]
    [InlineData(JobVisibilities.InternalOnly, JobStatuses.Active, true, false, JobAccessPolicy.CandidateRole, true)]
    [InlineData(JobVisibilities.InternalOnly, JobStatuses.Active, false, true, JobAccessPolicy.CandidateRole, true)]
    [InlineData(JobVisibilities.PartnerOnly, JobStatuses.Active, false, false, JobAccessPolicy.CandidateRole, false)]
    [InlineData(JobVisibilities.Public, JobStatuses.Paused, false, false, JobAccessPolicy.CandidateRole, false)]
    public void CanViewDetail_ShouldEnforceOwnershipStatusAndVisibility(
        string visibility, string status, bool isOwner, bool hasInternalAccess, string role, bool expected)
    {
        var job = CreateJob(visibility, status);

        JobAccessPolicy.CanViewDetail(job, isOwner, hasInternalAccess, [role]).Should().Be(expected);
    }

    [Fact]
    public void CanViewDetail_ShouldHandleNullRolesWithoutGrantingRestrictedAccess()
    {
        var job = CreateJob(JobVisibilities.PartnerOnly);

        JobAccessPolicy.CanViewDetail(job, false, false, null!).Should().BeFalse();
    }

    [Theory]
    [InlineData(JobVisibilities.Public, JobStatuses.Active, true)]
    [InlineData(JobVisibilities.PartnerOnly, JobStatuses.Active, false)]
    [InlineData(JobVisibilities.InternalOnly, JobStatuses.Active, false)]
    [InlineData(JobVisibilities.Public, JobStatuses.Paused, false)]
    public void CanCandidateApply_ShouldRequireCandidateOperationConditions(
        string visibility, string status, bool expected)
    {
        var job = CreateJob(visibility, status);

        JobAccessPolicy.CanCandidateApply(job, ["candidate"]).Should().Be(expected);
    }

    [Fact]
    public void CanCandidateApply_ShouldNotEscalateAffiliateOnlyOrNullRoles()
    {
        var job = CreateJob(JobVisibilities.Public);

        JobAccessPolicy.CanCandidateApply(job, [JobAccessPolicy.AffiliateRole]).Should().BeFalse();
        JobAccessPolicy.CanCandidateApply(job, null!).Should().BeFalse();
    }

    [Fact]
    public void CanCandidateApply_WithMultipleRoles_ShouldStillRejectPartnerOnlyJob()
    {
        var job = CreateJob(JobVisibilities.PartnerOnly);
        string[] roles = [JobAccessPolicy.CandidateRole, JobAccessPolicy.AffiliateRole];

        JobAccessPolicy.CanCandidateApply(job, roles).Should().BeFalse();
    }

    [Theory]
    [InlineData(JobVisibilities.Public, JobStatuses.Active, JobAccessPolicy.AffiliateRole, true)]
    [InlineData(JobVisibilities.PartnerOnly, JobStatuses.Active, "HEADHUNTER", false)]
    [InlineData(JobVisibilities.InternalOnly, JobStatuses.Active, JobAccessPolicy.AffiliateRole, false)]
    [InlineData(JobVisibilities.PartnerOnly, JobStatuses.Paused, JobAccessPolicy.AffiliateRole, false)]
    [InlineData(JobVisibilities.PartnerOnly, JobStatuses.Active, JobAccessPolicy.CandidateRole, false)]
    public void CanAffiliateSubmit_ShouldRequirePartnerOperationConditions(
        string visibility, string status, string role, bool expected)
    {
        var job = CreateJob(visibility, status);

        JobAccessPolicy.CanAffiliateSubmit(job, [role]).Should().Be(expected);
    }

    [Fact]
    public void CanAffiliateSubmit_WithMultipleRoles_ShouldStillRejectInternalOnlyJob()
    {
        var job = CreateJob(JobVisibilities.InternalOnly);
        string[] roles = [JobAccessPolicy.CandidateRole, JobAccessPolicy.AffiliateRole];

        JobAccessPolicy.CanAffiliateSubmit(job, roles).Should().BeFalse();
        JobAccessPolicy.CanAffiliateSubmit(job, null!).Should().BeFalse();
    }

    [Fact]
    public void CanManageJob_ShouldOnlyAllowOwningCompany()
    {
        var companyId = Guid.NewGuid();
        var job = CreateJob(JobVisibilities.InternalOnly);
        job.CompanyId = companyId;

        JobAccessPolicy.CanManageJob(job, companyId).Should().BeTrue();
        JobAccessPolicy.CanManageJob(job, Guid.NewGuid()).Should().BeFalse();
    }

    [Theory]
    [InlineData(ServiceTypeCodes.CvApplication, JobVisibilities.Public)]
    [InlineData(ServiceTypeCodes.CvApplication, JobVisibilities.InternalOnly)]
    [InlineData(ServiceTypeCodes.CvSourcing, JobVisibilities.PartnerOnly)]
    [InlineData(ServiceTypeCodes.CvSourcing, JobVisibilities.InternalOnly)]
    [InlineData(ServiceTypeCodes.HeadhuntCod, JobVisibilities.PartnerOnly)]
    [InlineData(ServiceTypeCodes.HeadhuntCod, JobVisibilities.InternalOnly)]
    [InlineData(" cv_application ", " public ")]
    [InlineData("headhunt_cod", "partner_only")]
    public void IsVisibilityAllowedForServiceType_ShouldAcceptValidMatrixPairs(
        string serviceType, string visibility)
    {
        JobAccessPolicy.IsVisibilityAllowedForServiceType(serviceType, visibility).Should().BeTrue();
    }

    [Theory]
    [InlineData(ServiceTypeCodes.CvApplication, JobVisibilities.PartnerOnly)]
    [InlineData(ServiceTypeCodes.CvSourcing, JobVisibilities.Public)]
    [InlineData(ServiceTypeCodes.HeadhuntCod, JobVisibilities.Public)]
    [InlineData("UNKNOWN", JobVisibilities.Public)]
    [InlineData(ServiceTypeCodes.CvApplication, "PRIVATE")]
    [InlineData("", JobVisibilities.Public)]
    [InlineData(ServiceTypeCodes.CvApplication, "")]
    [InlineData(null, JobVisibilities.Public)]
    [InlineData(ServiceTypeCodes.CvApplication, null)]
    public void IsVisibilityAllowedForServiceType_ShouldRejectInvalidOrMissingValues(
        string? serviceType, string? visibility)
    {
        JobAccessPolicy.IsVisibilityAllowedForServiceType(serviceType!, visibility!).Should().BeFalse();
    }

    private static Job CreateJob(string visibility, string status = JobStatuses.Active) => new()
    {
        JobId = Guid.NewGuid(),
        CompanyId = Guid.NewGuid(),
        ServiceTypeId = Guid.NewGuid(),
        CreatedBy = Guid.NewGuid(),
        Visibility = visibility,
        Status = status,
        CurrencyCode = "VND",
        Quantity = 1,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
