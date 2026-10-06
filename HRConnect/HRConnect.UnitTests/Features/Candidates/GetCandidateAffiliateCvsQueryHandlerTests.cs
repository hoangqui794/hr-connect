using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvs;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class GetCandidateAffiliateCvsQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();

    [Fact]
    public async Task Handle_ReturnsOnlyProjectedAffiliateDocumentsWithPagination()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId, Status = "ACTIVE" });
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvsAsync(
                candidateId, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<CandidateAffiliateCvRecord>
            {
                new(cvId, "CV Backend", "cv.pdf", "application/pdf", 1024, "ACTIVE", "ALLOWED",
                    Guid.NewGuid(), Guid.NewGuid(), "Affiliate A", 2, 1, 1, DateTime.UtcNow, DateTime.UtcNow)
            }, 1));

        var response = await Handler().Handle(
            new GetCandidateAffiliateCvsQuery(userId), CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Data.Items.Should().ContainSingle(item =>
            item.CvId == cvId &&
            item.AffiliateDisplayName == "Affiliate A" &&
            item.AffiliateReuseStatus == "ALLOWED");
        response.Data.Pagination.TotalItems.Should().Be(1);
    }

    [Theory]
    [InlineData("ARCHIVED", false)]
    [InlineData("ACTIVE", true)]
    public async Task Handle_WhenCandidateIsUnavailable_ThrowsConflict(string status, bool merged)
    {
        var userId = Guid.NewGuid();
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = userId,
                Status = status,
                MergedIntoCandidateId = merged ? Guid.NewGuid() : null
            });

        var action = () => Handler().Handle(
            new GetCandidateAffiliateCvsQuery(userId), CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        _submissions.Verify(repository => repository.GetCandidateAffiliateCvsAsync(
            It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private GetCandidateAffiliateCvsQueryHandler Handler() => new(_candidates.Object, _submissions.Object);
}
