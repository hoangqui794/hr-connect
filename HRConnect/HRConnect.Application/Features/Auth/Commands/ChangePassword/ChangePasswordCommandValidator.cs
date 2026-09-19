using System.Text.RegularExpressions;
using FluentValidation;

namespace HRConnect.Application.Features.Auth.Commands.ChangePassword;

public class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    private static readonly Regex PasswordRegex = new(
        @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_+\-=\[\]{}|;:,.<>])[A-Za-z\d@$!%*?&^#()_+\-=\[\]{}|;:,.<>]{8,}$",
        RegexOptions.Compiled);

    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Mật khẩu hiện tại không được để trống.");

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
