using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDownloadUrl;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class GetCandidateAffiliateCvDownloadUrlQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<ICvStorageService> _storage = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    [Fact]
    public async Task Handle_WhenCvBelongsToCandidate_ReturnsFiveMinuteUrlAndAuditsAccess()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddMinutes(5);
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId, Status = "ACTIVE" });
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Detail(cvId));
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

        var response = await Handler().Handle(
            new GetCandidateAffiliateCvDownloadUrlQuery(userId, cvId), CancellationToken.None);

        response.Data.DownloadUrl.Should().Be("https://signed.example/cv");
        response.Data.ExpiresAt.Should().Be(expiresAt);
        _audit.Verify(service => service.AddAsync(
            It.Is<AuditEntry>(entry =>
                entry.Action == AuditActions.CandidateAffiliateCvDownloadUrlIssued &&
                entry.EntityId == cvId &&
                entry.ActorUserId == userId),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCvIsOutsideCandidateScope_DoesNotSignOrAudit()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId, Status = "ACTIVE" });
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateAffiliateCvDetailRecord?)null);

        var action = () => Handler().Handle(
            new GetCandidateAffiliateCvDownloadUrlQuery(userId, cvId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
        _storage.Verify(service => service.GetCvDownloadUrlAsync(
            It.IsAny<Guid>(), It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>()), Times.Never);
        _audit.Verify(service => service.AddAsync(
            It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static CandidateAffiliateCvDetailRecord Detail(Guid cvId) =>
        new(cvId, "CV", "candidate.pdf", "application/pdf", 100, "ACTIVE", "NOT_GRANTED",
            Guid.NewGuid(), null, Guid.NewGuid(), "Affiliate", 1, 0, 1, 0, 0,
            DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow);

    private GetCandidateAffiliateCvDownloadUrlQueryHandler Handler() => new(
        _candidates.Object,
        _submissions.Object,
        _storage.Object,
        _audit.Object,
        _unitOfWork.Object);
}
