using FluentValidation;

namespace HRConnect.Application.Features.InternalHr.Commands.UpdateInternalHrProfile;

public class UpdateInternalHrProfileCommandValidator : AbstractValidator<UpdateInternalHrProfileCommand>
{
    public UpdateInternalHrProfileCommandValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Họ và tên nhân sự không được để trống.")
            .MinimumLength(2).WithMessage("Họ và tên nhân sự phải có tối thiểu 2 ký tự.")
            .MaximumLength(180).WithMessage("Họ và tên nhân sự không được vượt quá 180 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.Phone), () =>
        {
            RuleFor(x => x.Phone)
                .Matches(@"^[0-9+() \-\.]{8,20}$").WithMessage("Số điện thoại không đúng định dạng.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Department), () =>
        {
            RuleFor(x => x.Department!)
                .MaximumLength(120).WithMessage("Phòng ban không được vượt quá 120 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.JobTitle), () =>
        {
            RuleFor(x => x.JobTitle!)
                .MaximumLength(120).WithMessage("Chức vụ không được vượt quá 120 ký tự.");
        });
    }
}
