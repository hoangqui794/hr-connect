using System.Security.Claims;
using FluentAssertions;
using HRConnect.Presentation.Authorization;

namespace HRConnect.UnitTests.Authorization;

public class PermissionAuthorizationTests
{
    [Theory]
    [InlineData("cv.create")]
    [InlineData("cv.view_own")]
    [InlineData("cv.update_own")]
    [InlineData("cv.delete_own")]
    [InlineData("application.create")]
    [InlineData("submission.create")]
    [InlineData("application.view_own")]
    [InlineData("submission.view_own")]
    public void HasPermission_AllowsExactClaimAndRejectsMissingClaim(string permission)
    {
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", permission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, permission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, permission).Should().BeFalse();
        PermissionAuthorization.HasPermission(allowed, permission + ".other").Should().BeFalse();
    }

    [Fact]
    public void CandidateCvDownload_RequiresCvViewOwn()
    {
        const string requiredPermission = "cv.view_own";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void CandidateCvMetadataUpdate_RequiresCvUpdateOwn()
    {
        const string requiredPermission = "cv.update_own";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void SetCandidatePrimaryCv_RequiresCvUpdateOwn()
    {
        const string requiredPermission = "cv.update_own";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void DeleteCandidateCv_RequiresCvDeleteOwn()
    {
        const string requiredPermission = "cv.delete_own";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void CandidateApplyJob_RequiresApplicationCreate()
    {
        const string requiredPermission = "application.create";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void AffiliateSubmitCandidate_RequiresSubmissionCreate()
    {
        const string requiredPermission = "submission.create";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void CandidateApplicationList_RequiresApplicationViewOwn()
    {
        const string requiredPermission = "application.view_own";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void CandidateApplicationDetail_RequiresApplicationViewOwn()
    {
        const string requiredPermission = "application.view_own";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void AffiliateSubmissionList_RequiresSubmissionViewOwn()
    {
        const string requiredPermission = "submission.view_own";
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", requiredPermission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, requiredPermission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, requiredPermission).Should().BeFalse();
    }
}
