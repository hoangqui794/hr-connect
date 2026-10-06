using FluentValidation;

namespace HRConnect.Application.Features.Admin.Commands.UpdateAdminProfile;

public class UpdateAdminProfileCommandValidator : AbstractValidator<UpdateAdminProfileCommand>
{
    public UpdateAdminProfileCommandValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Họ và tên quản trị viên không được để trống.")
            .MinimumLength(2).WithMessage("Họ và tên quản trị viên phải có tối thiểu 2 ký tự.")
            .MaximumLength(180).WithMessage("Họ và tên quản trị viên không được vượt quá 180 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.Phone), () =>
        {
            RuleFor(x => x.Phone)
                .Matches(@"^[0-9+() \-\.]{8,20}$").WithMessage("Số điện thoại không đúng định dạng.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.JobTitle), () =>
        {
            RuleFor(x => x.JobTitle!)
                .MaximumLength(120).WithMessage("Chức danh không được vượt quá 120 ký tự.");
        });
    }
}
