using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvUsages;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class GetCandidateAffiliateCvUsagesQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();

    [Fact]
    public async Task Handle_ReturnsConsentApplicationAndLatestAiSummary()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId, Status = "ACTIVE" });
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Detail(cvId));
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvUsagesAsync(
                candidateId, cvId, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<CandidateAffiliateCvUsageRecord>
            {
                new(Guid.NewGuid(), Guid.NewGuid(), "Backend Developer", Guid.NewGuid(), "HR Connect",
                    Guid.NewGuid(), "Affiliate A", "ACCEPTED", now, "CONFIRMED", now.AddMinutes(-10),
                    now.AddDays(1), now, Guid.NewGuid(), "AI_PROCESSED", "AI_SCREENING", "COMPLETED",
                    88.5m, "HIGH", now)
            }, 1));

        var response = await Handler().Handle(
            new GetCandidateAffiliateCvUsagesQuery(userId, cvId), CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Data.Items.Should().ContainSingle(item =>
            item.JobTitle == "Backend Developer" &&
            item.ConsentStatus == "CONFIRMED" &&
            item.AiMatchScore == 88.5m);
        response.Data.Pagination.TotalItems.Should().Be(1);
    }

    [Fact]
    public async Task Handle_WhenCvIsOutsideCandidateScope_ThrowsNotFoundWithoutReadingUsages()
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
            new GetCandidateAffiliateCvUsagesQuery(userId, cvId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
        _submissions.Verify(repository => repository.GetCandidateAffiliateCvUsagesAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    private static CandidateAffiliateCvDetailRecord Detail(Guid cvId) =>
        new(cvId, "CV", "cv.pdf", "application/pdf", 100, "ACTIVE", "NOT_GRANTED",
            Guid.NewGuid(), null, Guid.NewGuid(), "Affiliate", 1, 0, 1, 0, 0,
            DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow);

    private GetCandidateAffiliateCvUsagesQueryHandler Handler() => new(_candidates.Object, _submissions.Object);
}
