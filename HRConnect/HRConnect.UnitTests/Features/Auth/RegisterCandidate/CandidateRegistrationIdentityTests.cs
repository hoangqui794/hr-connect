using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Auth.Common;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.RegisterCandidate;

public class CandidateRegistrationIdentityTests
{
    [Theory]
    [InlineData("phone_only")]
    [InlineData("split_identity_claimed")]
    [InlineData("already_claimed")]
    [InlineData("claimed_different_phone")]
    public async Task Resolve_RejectsUnprovenOrConflictingIdentity(string scenario)
    {
        var repository = new Mock<ICandidateRepository>();
        var currentUserId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            NormalizedEmail = "victim@example.com",
            NormalizedPhone = "84901234567"
        };

        var email = scenario == "phone_only" ? "other@example.com" : candidate.NormalizedEmail;
        var phone = scenario == "claimed_different_phone" ? "84907654321" : candidate.NormalizedPhone;

        if (scenario == "already_claimed")
            candidate.UserId = Guid.NewGuid(); // Claimed by someone else
        else if (scenario == "claimed_different_phone")
            candidate.UserId = currentUserId; // Claimed by current user but different phone

        repository.Setup(r => r.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(scenario == "phone_only" ? null : candidate);

        if (scenario == "split_identity_claimed")
        {
            repository.Setup(r => r.GetByNormalizedPhoneAsync(phone, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Candidate { CandidateId = Guid.NewGuid(), UserId = Guid.NewGuid() });
        }
        else
        {
            repository.Setup(r => r.GetByNormalizedPhoneAsync(phone, It.IsAny<CancellationToken>()))
                .ReturnsAsync(scenario == "claimed_different_phone" ? null : candidate);
        }

        var action = () => CandidateRegistrationIdentity.ResolveAsync(
            repository.Object,
            email,
            phone,
            CancellationToken.None,
            scenario == "claimed_different_phone" ? currentUserId : null);

        await action.Should().ThrowAsync<ConflictException>();
        repository.Verify(r => r.Update(It.IsAny<Candidate>()), Times.Never);
        repository.Verify(r => r.TryLinkByVerifiedEmailAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Resolve_AllowsUnclaimedCandidate_WithDifferentPhone()
    {
        // Arrange: Affiliate submitted candidate with phone 84901111111 (unclaimed, UserId = null)
        var repository = new Mock<ICandidateRepository>();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            NormalizedEmail = "candidate@example.com",
            NormalizedPhone = "84901111111",
            UserId = null
        };

        var email = "candidate@example.com";
        var differentPhone = "84909999999";

        repository.Setup(r => r.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);
        repository.Setup(r => r.GetByNormalizedPhoneAsync(differentPhone, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        // Act: Candidate registers with email candidate@example.com and a different phone number
        var result = await CandidateRegistrationIdentity.ResolveAsync(
            repository.Object,
            email,
            differentPhone,
            CancellationToken.None);

        // Assert: Resolves successfully to the candidate profile so it can be claimed
        result.Should().NotBeNull();
        result!.CandidateId.Should().Be(candidate.CandidateId);
    }
}
