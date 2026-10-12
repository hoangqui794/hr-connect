using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateSubmissionConsents;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class GetCandidateSubmissionConsentsQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsOwnedPendingConsentWithActionability()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var candidates = new Mock<ICandidateRepository>();
        var submissions = new Mock<ISubmissionRepository>();
        candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId, Status = "ACTIVE" });
        submissions.Setup(x => x.GetCandidateSubmissionConsentsAsync(
                candidateId, "PENDING", 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<CandidateSubmissionConsentRecord>
            {
                new(Guid.NewGuid(), "PENDING", "PENDING_CONSENT", Guid.NewGuid(), "Backend", Guid.NewGuid(),
                    "HR Connect", Guid.NewGuid(), "CV chính", "cv.pdf", Guid.NewGuid(), "Affiliate A",
                    DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(30), null)
            }, 1));

        var handler = new GetCandidateSubmissionConsentsQueryHandler(candidates.Object, submissions.Object);
        var response = await handler.Handle(new(userId), CancellationToken.None);

        response.Data.Total.Should().Be(1);
        response.Data.Items.Single().IsActionable.Should().BeTrue();
        response.Data.Items.Single().RemainingSeconds.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Handle_RejectsUnknownStatus()
    {
        var userId = Guid.NewGuid();
        var candidates = new Mock<ICandidateRepository>();
        candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" });
        var handler = new GetCandidateSubmissionConsentsQueryHandler(candidates.Object, Mock.Of<ISubmissionRepository>());

        var action = () => handler.Handle(new(userId, "INVALID"), CancellationToken.None);
        await action.Should().ThrowAsync<BadRequestException>();
    }
}
