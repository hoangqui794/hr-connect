using FluentAssertions;
using HRConnect.Infrastructure.Services.Identity;

namespace HRConnect.UnitTests.Common.Services;

public class PhoneNormalizerTests
{
    private readonly PhoneNormalizer _normalizer;

    public PhoneNormalizerTests()
    {
        _normalizer = new PhoneNormalizer();
    }

    [Theory]
    [InlineData("+84901234567", "0901234567")]
    [InlineData("84901234567", "0901234567")]
    [InlineData("0901234567", "0901234567")]
    [InlineData("+84 901 234 567", "0901234567")]
    [InlineData("0901-234-567", "0901234567")]
    [InlineData("(+84) 901.234.567", "0901234567")]
    public void Normalize_ShouldConvertVietnamesePhoneToStandardZeroPrefix(string input, string expected)
    {
        // Act
        var result = _normalizer.Normalize(input);

        // Assert
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Normalize_ShouldReturnNull_WhenInputIsNullOrWhitespace(string? input)
    {
        // Act
        var result = _normalizer.Normalize(input);

        // Assert
        result.Should().BeNull();
    }
}
