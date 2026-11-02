using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.IdentityClaims.GetIdentityClaimCvDownloadUrl;
using HRConnect.Application.Common.Models;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.IdentityClaims;

public sealed class GetIdentityClaimCvDownloadUrlQueryHandlerTests
{
    [Fact]
    public async Task Handle_WhenCandidateBelongsToClaim_ReturnsShortLivedDownloadUrl()
    {
        var claims = new Mock<ICandidateIdentityClaimRepository>();
        var storage = new Mock<ICvStorageService>();
        var claimId = Guid.NewGuid();
        var candidate = CandidateRecord(Guid.NewGuid());
        claims.Setup(x => x.GetAdminDetailAsync(claimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ClaimRecord(claimId, candidate));
        storage.Setup(x => x.GetCvDownloadUrlAsync(candidate.PrimaryCvId!.Value,
                TimeSpan.FromMinutes(5), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CvDownloadUrlResult
            {
                DownloadUrl = "https://storage.example/cv.pdf",
                ExpiresAt = DateTime.UtcNow.AddMinutes(5),
                FileName = "cv.pdf",
                MimeType = "application/pdf"
            });
        var handler = new GetIdentityClaimCvDownloadUrlQueryHandler(claims.Object, storage.Object);

        var response = await handler.Handle(
            new GetIdentityClaimCvDownloadUrlQuery(claimId, candidate.CandidateId),
            CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Data.CandidateId.Should().Be(candidate.CandidateId);
        response.Data.CvId.Should().Be(candidate.PrimaryCvId!.Value);
        response.Data.DownloadUrl.Should().Be("https://storage.example/cv.pdf");
    }

    [Fact]
    public async Task Handle_WhenCandidateDoesNotBelongToClaim_ReturnsControlledNotFound()
    {
        var claims = new Mock<ICandidateIdentityClaimRepository>();
        var storage = new Mock<ICvStorageService>();
        var claimId = Guid.NewGuid();
        claims.Setup(x => x.GetAdminDetailAsync(claimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ClaimRecord(claimId, CandidateRecord(Guid.NewGuid())));
        var handler = new GetIdentityClaimCvDownloadUrlQueryHandler(claims.Object, storage.Object);

        var action = () => handler.Handle(
            new GetIdentityClaimCvDownloadUrlQuery(claimId, Guid.NewGuid()),
            CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Hồ sơ Candidate này chưa có CV để đối chiếu.");
        storage.VerifyNoOtherCalls();
    }

    private static AdminIdentityClaimCandidateRecord CandidateRecord(Guid primaryCvId) => new(
        Guid.NewGuid(), Guid.NewGuid(), "Candidate", "candidate@example.com", "0900000000", "0900000000",
        "ACTIVE", null, 1, 0, 0, 0, 0, null, null, null, null, null,
        DateTime.UtcNow.AddDays(-1), DateTime.UtcNow, primaryCvId, "CV chính", "cv.pdf", "hash", "fingerprint");

    private static AdminIdentityClaimDetailRecord ClaimRecord(
        Guid claimId,
        AdminIdentityClaimCandidateRecord requester) => new(
        claimId, Guid.NewGuid(), "Requester", "new@example.com", "ACTIVE", "old@example.com",
        "old@example.com", "PENDING_ADMIN_REVIEW", null, DateTime.UtcNow.AddMinutes(5), 0, 0, null,
        DateTime.UtcNow, null, null, null, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow, Guid.NewGuid(),
        false, false, requester, null, null);
}
