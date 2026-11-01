using System.Text.RegularExpressions;
using FluentValidation;
using HRConnect.Application.Common.Validation;

namespace HRConnect.Application.Features.Auth.Commands.RegisterClient;

public class RegisterClientCommandValidator : AbstractValidator<RegisterClientCommand>
{
    private static readonly Regex PasswordRegex = new(
        @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_+\-=\[\]{}|;:,.<>])[A-Za-z\d@$!%*?&^#()_+\-=\[\]{}|;:,.<>]{8,}$",
        RegexOptions.Compiled);

    public RegisterClientCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.")
            .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Mật khẩu không được để trống.")
            .MinimumLength(8).WithMessage("Mật khẩu phải có độ dài tối thiểu 8 ký tự.")
            .Matches(PasswordRegex).WithMessage("Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên người đại diện không được để trống.")
            .MaximumLength(255).WithMessage("Họ và tên không được vượt quá 255 ký tự.");

        RuleFor(x => x.CompanyName)
            .NotEmpty().WithMessage("Tên công ty / doanh nghiệp không được để trống.")
            .MaximumLength(255).WithMessage("Tên công ty không được vượt quá 255 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.TaxCode), () =>
        {
            RuleFor(x => x.TaxCode!)
                .MaximumLength(50).WithMessage("Mã số thuế không được vượt quá 50 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Phone), () =>
        {
            RuleFor(x => x.Phone!)
                .Must(VietnamPhoneNumber.IsValid)
                .WithMessage("Số điện thoại không đúng định dạng số điện thoại Việt Nam hợp lệ.");
        });
    }
}
