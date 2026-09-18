using System.Text.RegularExpressions;
using FluentValidation;

namespace HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;

public class VerifyEmailOtpCommandValidator : AbstractValidator<VerifyEmailOtpCommand>
{
    private static readonly Regex OtpRegex = new(@"^\d{6}$", RegexOptions.Compiled);

    public VerifyEmailOtpCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.");

        RuleFor(x => x.Otp)
            .NotEmpty().WithMessage("Mã OTP không được để trống.")
            .Length(6).WithMessage("Mã OTP phải gồm đúng 6 chữ số.")
            .Matches(OtpRegex).WithMessage("Mã OTP chỉ được chứa các chữ số từ 0 đến 9.");
    }
}
