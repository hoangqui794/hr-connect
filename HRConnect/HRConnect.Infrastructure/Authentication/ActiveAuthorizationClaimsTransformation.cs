using System.Security.Claims;
using HRConnect.Application.Common.Interfaces.Repositories;
using Microsoft.AspNetCore.Authentication;

namespace HRConnect.Infrastructure.Authentication;

/// <summary>
/// Rebuilds authorization claims from current database state on every authenticated
/// request, so disabling a role/permission does not wait for an access token to expire.
/// </summary>
public sealed class ActiveAuthorizationClaimsTransformation : IClaimsTransformation
{
    private readonly IUserRepository _userRepository;

    public ActiveAuthorizationClaimsTransformation(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            return principal;
        }

        var subject = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var userId))
        {
            return principal;
        }

        var user = await _userRepository.GetByIdWithRolesAndPermissionsAsync(userId);
        var identity = new ClaimsIdentity(
            principal.Claims.Where(claim =>
                claim.Type != ClaimTypes.Role &&
                !string.Equals(claim.Type, "role", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(claim.Type, "permission", StringComparison.OrdinalIgnoreCase)),
            principal.Identity.AuthenticationType,
            ClaimTypes.Name,
            ClaimTypes.Role);

        if (user != null && string.Equals(user.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            var activeAssignments = user.UserRoleUsers
                .Where(assignment =>
                    string.Equals(assignment.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
                    assignment.Role.IsActive)
                .ToList();

            foreach (var role in activeAssignments.Select(assignment => assignment.Role.Code).Distinct())
            {
                identity.AddClaim(new Claim(ClaimTypes.Role, role));
            }

            foreach (var permission in activeAssignments
                         .SelectMany(assignment => assignment.Role.RolePermissions)
                         .Where(rolePermission => rolePermission.Permission.IsActive)
                         .Select(rolePermission => rolePermission.Permission.Code)
                         .Distinct())
            {
                identity.AddClaim(new Claim("permission", permission));
            }
        }

        return new ClaimsPrincipal(identity);
    }
}
