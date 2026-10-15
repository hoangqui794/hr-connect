using FluentAssertions;
using HRConnect.Application.Features.Jobs.Common;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

/// <summary>Dates without an offset used to make PostgreSQL timestamptz throw (HTTP 500 on create/update job).</summary>
public class JobDatesTests
{
    [Fact]
    public void Unspecified_IsTreatedAsUtc()
    {
        var value = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Unspecified);

        var result = JobDates.ToUtc(value);

        result.Should().Be(new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        result!.Value.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void Utc_IsKept()
    {
        var value = new DateTime(2026, 12, 31, 16, 59, 59, DateTimeKind.Utc);

        JobDates.ToUtc(value).Should().Be(value);
    }

    [Fact]
    public void Local_IsConvertedToUtc()
    {
        var value = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Local);

        var result = JobDates.ToUtc(value);

        result.Should().Be(value.ToUniversalTime());
        result!.Value.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void Null_StaysNull() => JobDates.ToUtc(null).Should().BeNull();
}
