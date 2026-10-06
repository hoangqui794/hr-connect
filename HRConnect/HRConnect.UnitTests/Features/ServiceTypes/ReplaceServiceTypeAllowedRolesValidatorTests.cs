using FluentAssertions;
using HRConnect.Application.Features.ServiceTypes.Commands.ReplaceServiceTypeAllowedRoles;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class ReplaceServiceTypeAllowedRolesValidatorTests
{
    private readonly ReplaceServiceTypeAllowedRolesValidator _validator = new();

    [Fact]
    public void Validate_AllowsAnEmptyRoleList_ToExplicitlyDisablePublicAccess()
    {
        var result = _validator.Validate(new ReplaceServiceTypeAllowedRolesCommand
        {
            ServiceTypeId = Guid.NewGuid(),
            Roles = Array.Empty<AllowedRoleInput>()
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_RejectsDuplicateRoleIds()
    {
        var roleId = Guid.NewGuid();
        var result = _validator.Validate(new ReplaceServiceTypeAllowedRolesCommand
        {
            ServiceTypeId = Guid.NewGuid(),
            Roles = new[]
            {
                new AllowedRoleInput(roleId, true, false),
                new AllowedRoleInput(roleId, false, true)
            }
        });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorMessage.Contains("trung roleId"));
    }
}
