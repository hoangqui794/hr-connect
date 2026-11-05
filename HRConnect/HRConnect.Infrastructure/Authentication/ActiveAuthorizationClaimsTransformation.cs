using System.Security.Claims;
using HRConnect.Application.Common.Interfaces.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Memory;

namespace HRConnect.Infrastructure.Authentication;

/// <summary>
/// Rebuilds authorization claims from current database state on authenticated
/// requests with short-lived in-memory caching and instant invalidation on RBAC/user updates.
/// </summary>
public sealed class ActiveAuthorizationClaimsTransformation : IClaimsTransformation
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);
    private static long _cacheGeneration = 1;

    private readonly IUserRepository _userRepository;
    private readonly IMemoryCache? _cache;

    public ActiveAuthorizationClaimsTransformation(
        IUserRepository userRepository,
        IMemoryCache? cache = null)
    {
        _userRepository = userRepository;
        _cache = cache;
    }

    public static void InvalidateCache() => Interlocked.Increment(ref _cacheGeneration);

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

        var snapshot = await ResolveSnapshotAsync(userId);
        if (snapshot == null || !string.Equals(snapshot.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            return new ClaimsPrincipal(new ClaimsIdentity());
        }

        var identity = new ClaimsIdentity(
            principal.Claims.Where(claim =>
                claim.Type != ClaimTypes.Role &&
                !string.Equals(claim.Type, "role", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(claim.Type, "permission", StringComparison.OrdinalIgnoreCase)),
            principal.Identity.AuthenticationType,
            ClaimTypes.Name,
            ClaimTypes.Role);

        foreach (var role in snapshot.Roles)
        {
            identity.AddClaim(new Claim(ClaimTypes.Role, role));
        }

        foreach (var permission in snapshot.Permissions)
        {
            identity.AddClaim(new Claim("permission", permission));
        }

        return new ClaimsPrincipal(identity);
    }

    private async Task<UserAuthorizationSnapshot?> ResolveSnapshotAsync(Guid userId)
    {
        var cacheKey = $"auth-claims:{Volatile.Read(ref _cacheGeneration)}:{userId:N}";
        if (_cache != null && _cache.TryGetValue<CachedSnapshot>(cacheKey, out var cached) && cached != null)
        {
            return cached.Snapshot;
        }

        var snapshot = await _userRepository.GetAuthorizationSnapshotAsync(userId);
        if (snapshot == null)
        {
            var user = await _userRepository.GetByIdWithRolesAndPermissionsAsync(userId);
            if (user != null)
            {
                var activeAssignments = user.UserRoleUsers
                    .Where(assignment =>
                        string.Equals(assignment.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
                        assignment.Role.IsActive)
                    .ToList();

                var roles = activeAssignments
                    .Select(assignment => assignment.Role.Code)
                    .Distinct()
                    .ToList();

                var permissions = activeAssignments
                    .SelectMany(assignment => assignment.Role.RolePermissions)
                    .Where(rolePermission => rolePermission.Permission.IsActive)
                    .Select(rolePermission => rolePermission.Permission.Code)
                    .Distinct()
                    .ToList();

                snapshot = new UserAuthorizationSnapshot(user.Status, roles, permissions);
            }
        }

        _cache?.Set(cacheKey, new CachedSnapshot(snapshot), CacheDuration);
        return snapshot;
    }

    private sealed record CachedSnapshot(UserAuthorizationSnapshot? Snapshot);
}
