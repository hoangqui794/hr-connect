using FluentValidation;

namespace HRConnect.Application.Features.Auth.Commands.ResendRegistrationOtp;

public class ResendRegistrationOtpCommandValidator : AbstractValidator<ResendRegistrationOtpCommand>
{
    public ResendRegistrationOtpCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.")
            .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.");
    }
}
