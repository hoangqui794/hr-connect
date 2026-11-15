using System;
using FluentAssertions;
using HRConnect.Application.Common;
using Xunit;

namespace HRConnect.UnitTests.Common;

public sealed class VietnamTimeTests
{
    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    [Theory]
    [InlineData("2026-11-13T16:59:59Z", 2026, 11, 13)]
    [InlineData("2026-11-13T17:00:00Z", 2026, 11, 14)]
    [InlineData("2026-11-13T20:34:00Z", 2026, 11, 14)]
    public void Today_WithTimeProvider_ShouldUseVietnamUtcPlus7Boundary(
        string utcIso,
        int expectedYear,
        int expectedMonth,
        int expectedDay)
    {
        var provider = new FixedTimeProvider(DateTimeOffset.Parse(utcIso));

        VietnamTime.Today(provider).Should().Be(new DateOnly(expectedYear, expectedMonth, expectedDay));
    }

    [Fact]
    public void ToDateOnly_WithUnspecifiedKind_ShouldTreatInputAsUtcBeforeAddingOffset()
    {
        var unspecifiedUtc = new DateTime(2026, 11, 13, 20, 32, 0, DateTimeKind.Unspecified);

        VietnamTime.ToDateOnly(unspecifiedUtc).Should().Be(new DateOnly(2026, 11, 14));
    }

    [Fact]
    public void ToDateOnly_WithLocalKind_ShouldNormalizeToUtcBeforeAddingOffset()
    {
        var utcInstant = new DateTime(2026, 11, 13, 20, 32, 0, DateTimeKind.Utc);
        var localInstant = utcInstant.ToLocalTime();

        VietnamTime.ToDateOnly(localInstant).Should().Be(new DateOnly(2026, 11, 14));
    }
}
