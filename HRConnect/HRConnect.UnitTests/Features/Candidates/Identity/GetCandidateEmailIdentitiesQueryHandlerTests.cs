using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Identity.GetCandidateEmailIdentities;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Candidates.Identity;

public sealed class GetCandidateEmailIdentitiesQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<IUserEmailIdentityRepository> _identities = new();

    [Fact]
    public async Task Handle_ReturnsOnlyIdentitiesOwnedByCurrentUser()
    {
        var userId = Guid.NewGuid();
        _candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = userId,
                Status = "ACTIVE"
            });
        _identities.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<UserEmailIdentity>
            {
                CreateIdentity(userId, "candidate@example.com", "PRIMARY", "VERIFIED"),
                CreateIdentity(userId, "old-email@example.com", "ALIAS", "VERIFIED")
            });
        var handler = new GetCandidateEmailIdentitiesQueryHandler(
            _candidates.Object, _identities.Object);

        var result = await handler.Handle(
            new GetCandidateEmailIdentitiesQuery(userId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Items.Should().HaveCount(2);
        result.Data.Items.Single(x => x.Kind == "PRIMARY").CanRevoke.Should().BeFalse();
        result.Data.Items.Single(x => x.Kind == "ALIAS").CanRevoke.Should().BeTrue();
        _identities.Verify(
            x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("ARCHIVED", false)]
    [InlineData("ACTIVE", true)]
    public async Task Handle_RejectsInactiveOrMergedCandidate(string status, bool merged)
    {
        var userId = Guid.NewGuid();
        _candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = userId,
                Status = status,
                MergedIntoCandidateId = merged ? Guid.NewGuid() : null
            });
        var handler = new GetCandidateEmailIdentitiesQueryHandler(
            _candidates.Object, _identities.Object);

        var action = () => handler.Handle(
            new GetCandidateEmailIdentitiesQuery(userId), CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        _identities.Verify(
            x => x.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static UserEmailIdentity CreateIdentity(
        Guid userId,
        string email,
        string kind,
        string status) => new()
    {
        EmailIdentityId = Guid.NewGuid(),
        UserId = userId,
        Email = email,
        NormalizedEmail = email,
        Kind = kind,
        Status = status,
        VerificationSource = "REGISTRATION",
        VerifiedAt = status == "VERIFIED" ? DateTime.UtcNow : null,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        ConcurrencyToken = Guid.NewGuid()
    };
}
