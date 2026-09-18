using FluentAssertions;
using HRConnect.Infrastructure.Services.Identity;

namespace HRConnect.UnitTests.Common.Services;

public class OtpServiceTests
{
    private readonly OtpService _otpService;

    public OtpServiceTests()
    {
        _otpService = new OtpService();
    }

    [Theory]
    [InlineData(6)]
    [InlineData(4)]
    [InlineData(8)]
    public void GenerateNumericOtp_ShouldReturnCorrectLengthAndAllDigits(int length)
    {
        // Act
        var otp = _otpService.GenerateNumericOtp(length);

        // Assert
        otp.Should().NotBeNullOrWhiteSpace();
        otp.Length.Should().Be(length);
        otp.Should().MatchRegex(@"^\d+$");
    }

    [Fact]
    public void HashOtp_ShouldProduceConsistentSha256HexHash()
    {
        // Arrange
        var otp = "123456";

        // Act
        var hash1 = _otpService.HashOtp(otp);
        var hash2 = _otpService.HashOtp(otp);

        // Assert
        hash1.Should().Be(hash2);
        hash1.Length.Should().Be(64); // SHA256 produces 64 hex characters
    }

    [Fact]
    public void VerifyOtp_ShouldReturnTrue_WhenOtpMatchesHash()
    {
        // Arrange
        var otp = "987654";
        var hash = _otpService.HashOtp(otp);

        // Act
        var isValid = _otpService.VerifyOtp(otp, hash);

        // Assert
        isValid.Should().BeTrue();
    }

    [Fact]
    public void VerifyOtp_ShouldReturnFalse_WhenOtpDoesNotMatchHash()
    {
        // Arrange
        var otp = "987654";
        var wrongOtp = "123456";
        var hash = _otpService.HashOtp(otp);

        // Act
        var isValid = _otpService.VerifyOtp(wrongOtp, hash);

        // Assert
        isValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("", "hash")]
    [InlineData(null, "hash")]
    [InlineData("123456", "")]
    [InlineData("123456", null)]
    public void VerifyOtp_ShouldReturnFalse_WhenInputIsNullOrEmpty(string? otp, string? hash)
    {
        // Act
        var isValid = _otpService.VerifyOtp(otp!, hash!);

        // Assert
        isValid.Should().BeFalse();
    }
}
