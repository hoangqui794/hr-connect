using FluentValidation;

namespace HRConnect.Application.Features.ServiceTypes.Commands.CreateServiceType;

public class CreateServiceTypeValidator : AbstractValidator<CreateServiceTypeCommand>
{
    public CreateServiceTypeValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã loại dịch vụ không được để trống.")
            .MaximumLength(50).WithMessage("Mã loại dịch vụ tối đa 50 ký tự.")
            .Matches(@"^[a-zA-Z0-9_]+$").WithMessage("Mã loại dịch vụ chỉ được chứa chữ cái, số và dấu gạch dưới (_).");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên loại dịch vụ không được để trống.")
            .MaximumLength(120).WithMessage("Tên loại dịch vụ tối đa 120 ký tự.");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Mô tả tối đa 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Description));
    }
}
