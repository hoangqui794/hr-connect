using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibraryDetail;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public sealed class GetAffiliateCandidateLibraryDetailQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfiles = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();

    [Fact]
    public async Task Handle_WhenCandidateIsOwned_ReturnsOnlyRepositoryApprovedCvs()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        _affiliateProfiles.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        _submissions.Setup(repository => repository.GetAffiliateCandidateLibraryDetailAsync(
                userId, candidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateCandidateLibraryDetailRecord(
                candidateId,
                "Candidate One",
                "candidate@example.com",
                "0900000000",
                false,
                2,
                new List<AffiliateCandidateCvRecord>
                {
                    new(cvId, "Backend CV", "candidate.pdf", "application/pdf", 1000, "ACTIVE",
                        DateTime.UtcNow.AddDays(-2), 2, DateTime.UtcNow.AddDays(-1))
                }));

        var handler = new GetAffiliateCandidateLibraryDetailQueryHandler(_affiliateProfiles.Object, _submissions.Object);
        var result = await handler.Handle(
            new GetAffiliateCandidateLibraryDetailQuery(userId, candidateId), CancellationToken.None);

        result.Data.CandidateId.Should().Be(candidateId);
        result.Data.Cvs.Should().ContainSingle();
        result.Data.Cvs[0].CvId.Should().Be(cvId);
        result.Data.HasAccount.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_WhenCandidateIsOutsideAffiliateLibrary_ThrowsNotFound()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        _affiliateProfiles.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        _submissions.Setup(repository => repository.GetAffiliateCandidateLibraryDetailAsync(
                userId, candidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateCandidateLibraryDetailRecord?)null);

        var handler = new GetAffiliateCandidateLibraryDetailQueryHandler(_affiliateProfiles.Object, _submissions.Object);
        var action = () => handler.Handle(
            new GetAffiliateCandidateLibraryDetailQuery(userId, candidateId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }
}
