using System.Text.RegularExpressions;
using FluentValidation;

namespace HRConnect.Application.Features.Auth.Commands.ResetPassword;

public class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    private static readonly Regex PasswordRegex = new(
        @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_+\-=\[\]{}|;:,.<>])[A-Za-z\d@$!%*?&^#()_+\-=\[\]{}|;:,.<>]{8,}$",
        RegexOptions.Compiled);

    private static readonly Regex OtpRegex = new(
        @"^\d{6}$",
        RegexOptions.Compiled);

    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.")
            .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.");

        RuleFor(x => x.Otp)
            .NotEmpty().WithMessage("Mã xác thực OTP không được để trống.")
            .Length(6).WithMessage("Mã xác thực OTP phải gồm 6 chữ số.")
            .Matches(OtpRegex).WithMessage("Mã xác thực OTP chỉ được chứa ký tự số.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Mật khẩu mới không được để trống.")
            .MinimumLength(8).WithMessage("Mật khẩu mới phải có độ dài tối thiểu 8 ký tự.")
            .Matches(PasswordRegex).WithMessage("Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.");

        When(x => !string.IsNullOrWhiteSpace(x.ConfirmPassword), () =>
        {
            RuleFor(x => x.ConfirmPassword)
                .Equal(x => x.NewPassword)
                .WithMessage("Mật khẩu xác nhận không khớp với mật khẩu mới.");
        });
    }
}
