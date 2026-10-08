using FluentValidation;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Candidates.Identity.VerifyCandidateIdentityClaim;

public sealed class VerifyCandidateIdentityClaimCommandValidator
    : AbstractValidator<VerifyCandidateIdentityClaimCommand>
{
    public VerifyCandidateIdentityClaimCommandValidator(IOptions<AuthenticationSettings> options)
    {
        var length = options.Value.Otp?.Length > 0 ? options.Value.Otp.Length : 6;
        RuleFor(command => command.Otp)
            .NotEmpty().WithMessage("Mã OTP là bắt buộc.")
            .Matches($"^\\d{{{length}}}$").WithMessage($"Mã OTP phải gồm đúng {length} chữ số.");
        RuleFor(command => command.ConcurrencyToken)
            .NotEmpty().WithMessage("Concurrency token là bắt buộc.");
    }
}
