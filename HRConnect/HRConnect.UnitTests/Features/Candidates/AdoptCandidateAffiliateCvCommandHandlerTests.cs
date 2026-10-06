using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Commands.AdoptCandidateAffiliateCv;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class AdoptCandidateAffiliateCvCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ICandidateCvRepository> _candidateCvs = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<ICvStorageService> _storage = new();

    [Fact]
    public async Task Handle_WhenAcceptedAffiliateCvIsEligible_CreatesIndependentPersonalCopy()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var sourceCvId = Guid.NewGuid();
        var adoptedCvId = Guid.NewGuid();
        SetupCandidate(userId, candidateId);
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, sourceCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Detail(sourceCvId, "ACTIVE", acceptedCount: 1));
        _candidateCvs.Setup(repository => repository.GetAdoptedBySourceCvIdAsync(
                candidateId, sourceCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateCv?)null);
        _storage.Setup(service => service.AdoptAffiliateCvAsync(
                candidateId, userId, sourceCvId, "CV Backend", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadCvResult
            {
                CvId = adoptedCvId,
                CandidateId = candidateId,
                Title = "CV Backend",
                FileName = "cv.pdf",
                Status = "ACTIVE",
                IsPrimary = false,
                CreatedAt = DateTime.UtcNow
            });

        var response = await Handler().Handle(
            new AdoptCandidateAffiliateCvCommand(userId, sourceCvId, "CV Backend"),
            CancellationToken.None);

        response.Data.SourceCvId.Should().Be(sourceCvId);
        response.Data.CvId.Should().Be(adoptedCvId);
        response.Data.AlreadyAdopted.Should().BeFalse();
        response.Data.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_WhenCvWasAlreadyAdopted_ReturnsExistingCopyWithoutCopyingAgain()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var sourceCvId = Guid.NewGuid();
        SetupCandidate(userId, candidateId);
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, sourceCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Detail(sourceCvId, "ACTIVE", acceptedCount: 1));
        _candidateCvs.Setup(repository => repository.GetAdoptedBySourceCvIdAsync(
                candidateId, sourceCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateCv
            {
                CvId = Guid.NewGuid(),
                CandidateId = candidateId,
                AdoptedFromCvId = sourceCvId,
                Title = "CV đã nhận",
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow
            });

        var response = await Handler().Handle(
            new AdoptCandidateAffiliateCvCommand(userId, sourceCvId, null),
            CancellationToken.None);

        response.Data.AlreadyAdopted.Should().BeTrue();
        _storage.Verify(service => service.AdoptAffiliateCvAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("PENDING_CONSENT", 0)]
    [InlineData("ARCHIVED", 0)]
    [InlineData("ACTIVE", 0)]
    public async Task Handle_WhenCvHasNoAcceptedConsent_ThrowsBusinessConflict(
        string documentStatus,
        int acceptedCount)
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var sourceCvId = Guid.NewGuid();
        SetupCandidate(userId, candidateId);
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, sourceCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Detail(sourceCvId, documentStatus, acceptedCount));

        var action = () => Handler().Handle(
            new AdoptCandidateAffiliateCvCommand(userId, sourceCvId, null),
            CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("AFFILIATE_CV_NOT_ADOPTABLE");
        _storage.Verify(service => service.AdoptAffiliateCvAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    private void SetupCandidate(Guid userId, Guid candidateId) =>
        _candidates.Setup(repository => repository.GetByUserIdAsync(
                userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = candidateId,
                UserId = userId,
                Status = "ACTIVE"
            });

    private static CandidateAffiliateCvDetailRecord Detail(
        Guid cvId,
        string documentStatus,
        int acceptedCount) =>
        new(
            cvId, "Affiliate CV", "cv.pdf", "application/pdf", 1024,
            documentStatus, "ALLOWED", Guid.NewGuid(), null,
            Guid.NewGuid(), "Affiliate", 1, 0, acceptedCount, 0, 0,
            DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow);

    private AdoptCandidateAffiliateCvCommandHandler Handler() =>
        new(_candidates.Object, _candidateCvs.Object, _submissions.Object, _storage.Object);
}
