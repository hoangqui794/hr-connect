using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Common;

namespace HRConnect.UnitTests.Features.Recruitment;

public class Mf04InputPolicyTests
{
    [Theory]
    [InlineData("ONLINE", "ONLINE")]
    [InlineData("Trực tuyến", "ONLINE")]
    [InlineData("OFFLINE", "OFFLINE")]
    [InlineData("Trực tiếp", "OFFLINE")]
    [InlineData("ONSITE", "OFFLINE")]
    [InlineData("PHONE", "PHONE")]
    [InlineData("Điện thoại", "PHONE")]
    public void NormalizeInterviewType_WhenAliasIsSupported_ShouldReturnCanonicalValue(
        string input,
        string expected)
    {
        Mf04InputPolicy.NormalizeInterviewType(input).Should().Be(expected);
    }

    [Fact]
    public void NormalizeInterviewType_WhenValueIsUnsupported_ShouldRejectIt()
    {
        Action act = () => Mf04InputPolicy.NormalizeInterviewType("CHAT_APP");

        act.Should().Throw<BadRequestException>()
            .WithMessage("*ONLINE, OFFLINE hoặc PHONE*");
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://files.example.com/interview")]
    [InlineData("not-a-url")]
    public void NormalizeMeetingLink_WhenSchemeIsUnsafeOrInvalid_ShouldRejectIt(string input)
    {
        Action act = () => Mf04InputPolicy.NormalizeMeetingLink(input);

        act.Should().Throw<BadRequestException>()
            .WithMessage("*HTTP hoặc HTTPS*");
    }

    [Fact]
    public void NormalizeMeetingLink_WhenHttpsUrlHasWhitespace_ShouldTrimIt()
    {
        Mf04InputPolicy.NormalizeMeetingLink("  https://meet.example.com/room  ")
            .Should().Be("https://meet.example.com/room");
    }

    [Theory]
    [InlineData("ONLINE", null, null, "*link phòng họp*")]
    [InlineData("OFFLINE", null, null, "*địa điểm*")]
    public void EnsureInterviewVenue_WhenRequiredDeliveryDetailIsMissing_ShouldRejectIt(
        string interviewType,
        string? location,
        string? meetingLink,
        string expectedMessage)
    {
        Action act = () => Mf04InputPolicy.EnsureInterviewVenue(interviewType, location, meetingLink);

        act.Should().Throw<BadRequestException>().WithMessage(expectedMessage);
    }

    [Theory]
    [InlineData("ONLINE", null, "https://meet.example.com/room")]
    [InlineData("OFFLINE", "Phòng họp A", null)]
    [InlineData("PHONE", null, null)]
    public void EnsureInterviewVenue_WhenRequiredDeliveryDetailExists_ShouldAcceptIt(
        string interviewType,
        string? location,
        string? meetingLink)
    {
        Action act = () => Mf04InputPolicy.EnsureInterviewVenue(interviewType, location, meetingLink);

        act.Should().NotThrow();
    }
}
