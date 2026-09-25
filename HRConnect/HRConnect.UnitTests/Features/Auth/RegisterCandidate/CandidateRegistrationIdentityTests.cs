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
    [InlineData("different_phone")]
    [InlineData("split_identity")]
    [InlineData("already_claimed")]
    public async Task Resolve_RejectsUnprovenOrConflictingIdentity(string scenario)
    {
        var repository = new Mock<ICandidateRepository>();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), NormalizedEmail = "victim@example.com", NormalizedPhone = "84901234567" };
        var email = scenario == "phone_only" ? "other@example.com" : candidate.NormalizedEmail;
        var phone = scenario == "different_phone" ? "84907654321" : candidate.NormalizedPhone;
        if (scenario == "already_claimed") candidate.UserId = Guid.NewGuid();
        repository.Setup(r => r.GetByNormalizedEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(scenario == "phone_only" ? null : candidate);
        repository.Setup(r => r.GetByNormalizedPhoneAsync(phone, It.IsAny<CancellationToken>()))
            .ReturnsAsync(scenario == "split_identity" ? new Candidate { CandidateId = Guid.NewGuid() } : scenario == "different_phone" ? null : candidate);

        var action = () => CandidateRegistrationIdentity.ResolveAsync(repository.Object, email, phone, CancellationToken.None);
        await action.Should().ThrowAsync<ConflictException>();
        repository.Verify(r => r.Update(It.IsAny<Candidate>()), Times.Never);
        repository.Verify(r => r.TryLinkByVerifiedEmailAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
