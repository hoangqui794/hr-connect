using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDetail;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class GetCandidateAffiliateCvDetailQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();

    [Fact]
    public async Task Handle_WhenCvBelongsToCandidate_ReturnsDetail()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var concurrencyToken = Guid.NewGuid();
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId, Status = "ACTIVE" });
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateAffiliateCvDetailRecord(
                cvId, "CV Backend", "cv.pdf", "application/pdf", 2048, "ACTIVE", "ALLOWED",
                concurrencyToken, DateTime.UtcNow, Guid.NewGuid(), "Affiliate A", 4, 1, 1, 1, 1,
                DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow));

        var response = await Handler().Handle(
            new GetCandidateAffiliateCvDetailQuery(userId, cvId), CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Data.CvId.Should().Be(cvId);
        response.Data.ReuseConcurrencyToken.Should().Be(concurrencyToken);
        response.Data.SubmissionCount.Should().Be(4);
        response.Data.DeclinedSubmissionCount.Should().Be(1);
        response.Data.ExpiredSubmissionCount.Should().Be(1);
    }

    [Fact]
    public async Task Handle_WhenCvDoesNotBelongToCandidate_ThrowsNotFound()
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
            new GetCandidateAffiliateCvDetailQuery(userId, cvId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WhenCandidateIsMerged_ThrowsConflictBeforeReadingCv()
    {
        var userId = Guid.NewGuid();
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = userId,
                Status = "ACTIVE",
                MergedIntoCandidateId = Guid.NewGuid()
            });

        var action = () => Handler().Handle(
            new GetCandidateAffiliateCvDetailQuery(userId, Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        _submissions.Verify(repository => repository.GetCandidateAffiliateCvDetailAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private GetCandidateAffiliateCvDetailQueryHandler Handler() => new(_candidates.Object, _submissions.Object);
}
