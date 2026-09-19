using FluentValidation;

namespace HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;

public class UpdateCompanyProfileCommandValidator : AbstractValidator<UpdateCompanyProfileCommand>
{
    public UpdateCompanyProfileCommandValidator()
    {
        RuleFor(x => x.CompanyName)
            .NotEmpty().WithMessage("Tên công ty không được để trống.")
            .MinimumLength(2).WithMessage("Tên công ty phải có tối thiểu 2 ký tự.")
            .MaximumLength(255).WithMessage("Tên công ty không được vượt quá 255 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.TaxCode), () =>
        {
            RuleFor(x => x.TaxCode!)
                .MaximumLength(80).WithMessage("Mã số thuế không được vượt quá 80 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Industry), () =>
        {
            RuleFor(x => x.Industry!)
                .MaximumLength(120).WithMessage("Ngành nghề không được vượt quá 120 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.CompanySize), () =>
        {
            RuleFor(x => x.CompanySize!)
                .MaximumLength(50).WithMessage("Quy mô công ty không được vượt quá 50 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Website), () =>
        {
            RuleFor(x => x.Website!)
                .MaximumLength(255).WithMessage("Website không được vượt quá 255 ký tự.")
                .Must(uri => Uri.TryCreate(uri, UriKind.Absolute, out var outUri) && (outUri.Scheme == Uri.UriSchemeHttp || outUri.Scheme == Uri.UriSchemeHttps))
                .WithMessage("Website không đúng định dạng URL hợp lệ (ví dụ: https://example.com).");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Address), () =>
        {
            RuleFor(x => x.Address!)
                .MaximumLength(500).WithMessage("Địa chỉ không được vượt quá 500 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Description), () =>
        {
            RuleFor(x => x.Description!)
                .MaximumLength(4000).WithMessage("Mô tả công ty không được vượt quá 4000 ký tự.");
        });
    }
}
