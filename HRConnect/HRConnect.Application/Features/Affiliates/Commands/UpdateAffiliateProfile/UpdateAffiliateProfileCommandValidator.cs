using FluentValidation;

namespace HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateProfile;

public class UpdateAffiliateProfileCommandValidator : AbstractValidator<UpdateAffiliateProfileCommand>
{
    public UpdateAffiliateProfileCommandValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Tên hiển thị đối tác không được để trống.")
            .MinimumLength(2).WithMessage("Tên hiển thị đối tác phải có tối thiểu 2 ký tự.")
            .MaximumLength(180).WithMessage("Tên hiển thị đối tác không được vượt quá 180 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.ContactPerson), () =>
        {
            RuleFor(x => x.ContactPerson)
                .MaximumLength(180).WithMessage("Tên người liên hệ không được vượt quá 180 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Phone), () =>
        {
            RuleFor(x => x.Phone)
                .Matches(@"^[0-9+() \-\.]{8,20}$").WithMessage("Số điện thoại không đúng định dạng.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Address), () =>
        {
            RuleFor(x => x.Address)
                .MaximumLength(500).WithMessage("Địa chỉ không được vượt quá 500 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.TaxInformation), () =>
        {
            RuleFor(x => x.TaxInformation)
                .MaximumLength(50).WithMessage("Thông tin mã số thuế không được vượt quá 50 ký tự.");
        });
    }
}
