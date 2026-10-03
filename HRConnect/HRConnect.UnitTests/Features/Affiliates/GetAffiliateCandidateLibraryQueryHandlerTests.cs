using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibrary;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public sealed class GetAffiliateCandidateLibraryQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfiles = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();

    [Fact]
    public async Task Handle_ReturnsOwnedAcceptedCandidatesWithPagination()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        _affiliateProfiles.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        _submissions.Setup(repository => repository.GetAffiliateCandidateLibraryAsync(
                userId, "nguyen", "candidateName", "asc", 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<AffiliateCandidateLibraryRecord>
            {
                new(candidateId, "Nguyen Van A", "a@example.com", "0900000000", true, 2, 3, DateTime.UtcNow)
            }, 1));

        var handler = new GetAffiliateCandidateLibraryQueryHandler(_affiliateProfiles.Object, _submissions.Object);
        var result = await handler.Handle(
            new GetAffiliateCandidateLibraryQuery(userId, " nguyen ", 1, 20, "candidateName", "asc"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Items.Should().ContainSingle();
        result.Data.Items[0].CandidateId.Should().Be(candidateId);
        result.Data.Items[0].ActiveCvCount.Should().Be(2);
        result.Data.Pagination.TotalItems.Should().Be(1);
    }

    [Fact]
    public async Task Handle_WhenAffiliateProfileMissing_ThrowsForbidden()
    {
        var userId = Guid.NewGuid();
        _affiliateProfiles.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);
        var handler = new GetAffiliateCandidateLibraryQueryHandler(_affiliateProfiles.Object, _submissions.Object);

        var action = () => handler.Handle(new GetAffiliateCandidateLibraryQuery(userId), CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
    }

    [Theory]
    [InlineData("unknown", "desc")]
    [InlineData("candidateName", "sideways")]
    public async Task Handle_WithInvalidSort_ThrowsBadRequest(string sortBy, string sortDirection)
    {
        var userId = Guid.NewGuid();
        _affiliateProfiles.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        var handler = new GetAffiliateCandidateLibraryQueryHandler(_affiliateProfiles.Object, _submissions.Object);

        var action = () => handler.Handle(
            new GetAffiliateCandidateLibraryQuery(userId, SortBy: sortBy, SortDirection: sortDirection),
            CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
    }
}
