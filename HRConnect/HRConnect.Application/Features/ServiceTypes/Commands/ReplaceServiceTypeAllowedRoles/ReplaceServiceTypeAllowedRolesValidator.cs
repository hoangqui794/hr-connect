using FluentValidation;

namespace HRConnect.Application.Features.ServiceTypes.Commands.ReplaceServiceTypeAllowedRoles;

public sealed class ReplaceServiceTypeAllowedRolesValidator : AbstractValidator<ReplaceServiceTypeAllowedRolesCommand>
{
    public ReplaceServiceTypeAllowedRolesValidator()
    {
        RuleFor(command => command.ServiceTypeId)
            .NotEmpty().WithMessage("ID loai dich vu khong hop le.");

        RuleForEach(command => command.Roles)
            .ChildRules(role => role.RuleFor(item => item.RoleId)
                .NotEmpty().WithMessage("Role ID khong hop le."));

        RuleFor(command => command.Roles)
            .Must(roles => roles.Select(role => role.RoleId).Distinct().Count() == roles.Count)
            .WithMessage("Danh sach role khong duoc trung roleId.");
    }
}
