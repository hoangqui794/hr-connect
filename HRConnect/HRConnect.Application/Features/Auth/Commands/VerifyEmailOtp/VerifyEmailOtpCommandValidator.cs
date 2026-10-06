using FluentValidation;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;

public class VerifyEmailOtpCommandValidator : AbstractValidator<VerifyEmailOtpCommand>
{
    public VerifyEmailOtpCommandValidator(IOptions<AuthenticationSettings> options)
    {
        var otpLength = options.Value.Otp.Length;
        if (otpLength is < 4 or > 12)
        {
            throw new InvalidOperationException("Authentication:Otp:Length phải nằm trong khoảng 4 đến 12.");
        }

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.");

        RuleFor(x => x.Otp)
            .NotEmpty().WithMessage("Mã OTP không được để trống.")
            .Length(otpLength).WithMessage($"Mã OTP phải gồm đúng {otpLength} chữ số.")
            .Matches($@"^\d{{{otpLength}}}$").WithMessage("Mã OTP chỉ được chứa các chữ số từ 0 đến 9.");
    }
}
