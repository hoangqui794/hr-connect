using FluentAssertions;
using HRConnect.Application.Common.Settings;
using HRConnect.Infrastructure.Services.Identity;
using Microsoft.Extensions.Options;
using Xunit;

namespace HRConnect.UnitTests.Services.Identity;

public sealed class CandidateIdentityEvidenceProtectorTests
{
    [Fact]
    public void Protect_WhenDisabled_DoesNotPersistGuessableIdentityEvidence()
    {
        var protector = Create(new CandidateIdentityEvidenceSettings { Enabled = false });

        var result = protector.Protect("Nguyễn Văn A", "candidate@example.com", "0900000001");

        result.IsEnabled.Should().BeFalse();
        result.NormalizedNameHash.Should().BeNull();
        result.EmailHmac.Should().BeNull();
        result.PhoneHmac.Should().BeNull();
        result.KeyVersion.Should().BeNull();
    }

    [Fact]
    public void Protect_NormalizesVietnameseNameAndProducesDeterministicNonReversibleEvidence()
    {
        var settings = new CandidateIdentityEvidenceSettings
        {
            Enabled = true,
            ActiveKeyVersion = "2026-10",
            Keys = new Dictionary<string, string>
            {
                ["2026-10"] = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray())
            }
        };
        var protector = Create(settings);

        var first = protector.Protect(" Nguyễn   Văn Á ", "candidate@example.com", "0900000001");
        var second = protector.Protect("nguyen van a", "candidate@example.com", "0900000001");

        first.IsEnabled.Should().BeTrue();
        first.KeyVersion.Should().Be("2026-10");
        first.NormalizedNameHash.Should().Be(second.NormalizedNameHash);
        first.EmailHmac.Should().Be(second.EmailHmac);
        first.PhoneHmac.Should().Be(second.PhoneHmac);
        first.EmailHmac.Should().NotBe("candidate@example.com");
        first.EmailHmac.Should().HaveLength(64);
    }

    [Fact]
    public void Protect_WhenEnabledWithoutStrongSecret_FailsClosed()
    {
        var protector = Create(new CandidateIdentityEvidenceSettings
        {
            Enabled = true,
            ActiveKeyVersion = "v1",
            Keys = new Dictionary<string, string> { ["v1"] = Convert.ToBase64String(new byte[16]) }
        });

        var action = () => protector.Protect("Candidate", "candidate@example.com", null);

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*at least 32 bytes*");
    }

    private static CandidateIdentityEvidenceProtector Create(CandidateIdentityEvidenceSettings settings) =>
        new(Options.Create(settings));
}
