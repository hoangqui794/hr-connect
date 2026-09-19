using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateProfileVisibility;

public class UpdateProfileVisibilityCommandValidator : AbstractValidator<UpdateProfileVisibilityCommand>
{
    private static readonly string[] AllowedVisibilities = { "PUBLIC", "PRIVATE" };

    public UpdateProfileVisibilityCommandValidator()
    {
        RuleFor(x => x.Visibility)
            .NotEmpty().WithMessage("Chế độ hiển thị hồ sơ không được để trống.")
            .Must(v => !string.IsNullOrWhiteSpace(v) && AllowedVisibilities.Contains(v.Trim().ToUpperInvariant()))
            .WithMessage("Chế độ hiển thị hồ sơ chỉ chấp nhận giá trị PUBLIC hoặc PRIVATE.");
    }
}
