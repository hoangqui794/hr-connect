using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Common;

namespace HRConnect.UnitTests.Features.Recruitment;

public class Mf04ConcurrencyGuardTests
{
    [Fact]
    public void EnsureMatches_WhenPersistedTokenIsMissing_ShouldThrowBadRequestException()
    {
        var currentToken = Guid.NewGuid();

        Action act = () => Mf04ConcurrencyGuard.EnsureMatches(null, currentToken, "offer");

        act.Should().Throw<BadRequestException>()
            .WithMessage("*concurrencyToken*offer*");
    }

    [Fact]
    public void EnsureMatches_WhenTokenIsStale_ShouldThrowConflictException()
    {
        Action act = () => Mf04ConcurrencyGuard.EnsureMatches(Guid.NewGuid(), Guid.NewGuid(), "phỏng vấn");

        act.Should().Throw<ConflictException>()
            .WithMessage("*phỏng vấn*thay đổi*");
    }

    [Fact]
    public void EnsureMatches_WhenTokenMatches_ShouldNotThrow()
    {
        var token = Guid.NewGuid();

        Action act = () => Mf04ConcurrencyGuard.EnsureMatches(token, token, "hồ sơ ứng tuyển");

        act.Should().NotThrow();
    }
}
