using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateCv;

public class UpdateCandidateCvCommandValidator : AbstractValidator<UpdateCandidateCvCommand>
{
    public UpdateCandidateCvCommandValidator()
    {
        RuleFor(x => x.Title)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Tiêu đề CV không được để trống.")
            .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Tiêu đề CV không được chỉ chứa khoảng trắng.")
            .MaximumLength(180).WithMessage("Tiêu đề CV không được vượt quá 180 ký tự.");
    }
}
