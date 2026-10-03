using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateCvDownloadUrl;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public sealed class GetAffiliateCandidateCvDownloadUrlQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfiles = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<ICvStorageService> _storage = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    [Fact]
    public async Task Handle_WhenCvIsOwned_ReturnsFiveMinuteUrlAndAuditsAccess()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddMinutes(5);
        _affiliateProfiles.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        _submissions.Setup(repository => repository.GetAffiliateCandidateCvAccessAsync(
                userId, candidateId, cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateCandidateCvAccessRecord(candidateId, cvId, "candidate.pdf"));
        _storage.Setup(service => service.GetCvDownloadUrlAsync(
                cvId, TimeSpan.FromMinutes(5), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CvDownloadUrlResult
            {
                CvId = cvId,
                FileName = "candidate.pdf",
                MimeType = "application/pdf",
                DownloadUrl = "https://signed.example/cv",
                ExpiresAt = expiresAt
            });

        var handler = CreateHandler();
        var result = await handler.Handle(
            new GetAffiliateCandidateCvDownloadUrlQuery(userId, candidateId, cvId), CancellationToken.None);

        result.Data.DownloadUrl.Should().Be("https://signed.example/cv");
        result.Data.ExpiresAt.Should().Be(expiresAt);
        _audit.Verify(service => service.AddAsync(
            It.Is<AuditEntry>(entry =>
                entry.Action == AuditActions.AffiliateCvViewed &&
                entry.EntityId == cvId &&
                entry.ActorUserId == userId),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCvIsOutsideAffiliateLibrary_ThrowsNotFoundWithoutSigningUrl()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        _affiliateProfiles.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        _submissions.Setup(repository => repository.GetAffiliateCandidateCvAccessAsync(
                userId, candidateId, cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateCandidateCvAccessRecord?)null);

        var handler = CreateHandler();
        var action = () => handler.Handle(
            new GetAffiliateCandidateCvDownloadUrlQuery(userId, candidateId, cvId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
        _storage.Verify(service => service.GetCvDownloadUrlAsync(
            It.IsAny<Guid>(), It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private GetAffiliateCandidateCvDownloadUrlQueryHandler CreateHandler() => new(
        _affiliateProfiles.Object,
        _submissions.Object,
        _storage.Object,
        _audit.Object,
        _unitOfWork.Object);
}
