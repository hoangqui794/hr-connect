using FluentAssertions;
using HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;
using HRConnect.Application.Features.Recruitment.Common;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class UpdateApplicationScreeningStatusCommandValidatorTests
{
    private readonly UpdateApplicationScreeningStatusCommandValidator _validator = new();

    [Theory]
    [InlineData("SKILL_MISMATCH", null)]
    [InlineData("position_filled", "")]
    [InlineData("OTHER", "Ứng viên yêu cầu làm việc từ xa toàn thời gian.")]
    public void Reject_WithValidCode_ShouldPass(string reasonCode, string? note)
    {
        _validator.Validate(Command("REJECTED", reasonCode, note)).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("TOO_OLD")]
    public void Reject_WithMissingOrUnknownCode_ShouldFail(string? reasonCode)
    {
        var result = _validator.Validate(Command("REJECTED", reasonCode, "note"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateApplicationScreeningStatusCommand.ReasonCode));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public void Reject_WithOtherAndNoNote_ShouldFail(string? note)
    {
        var result = _validator.Validate(Command("REJECTED", ApplicationReasonCodes.Other, note));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateApplicationScreeningStatusCommand.Reason));
    }

    [Fact]
    public void Shortlist_WithoutCodeOrNote_ShouldPass()
    {
        _validator.Validate(Command("SHORTLISTED", null, null)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Note_LongerThanLimit_ShouldFail()
    {
        var note = new string('x', ApplicationReasonCodes.MaxNoteLength + 1);

        _validator.Validate(Command("SHORTLISTED", null, note)).IsValid.Should().BeFalse();
    }

    [Fact]
    public void MissingConcurrencyToken_ShouldFail()
    {
        var command = Command("SHORTLISTED", null, null) with { ConcurrencyToken = null };

        _validator.Validate(command).IsValid.Should().BeFalse();
    }

    private static UpdateApplicationScreeningStatusCommand Command(string target, string? reasonCode, string? note) => new(
        Guid.NewGuid(),
        Guid.NewGuid(),
        target,
        note,
        reasonCode,
        Guid.NewGuid(),
        Guid.NewGuid(),
        ScreeningActor.InternalHr);
}
