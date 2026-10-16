namespace HRConnect.Application.Features.Admin.Authorization;

public interface IAuthorizationAdminService
{
    Task<PagedAuthorizationResult<PermissionSummaryDto>> GetPermissionsAsync(
        string? search, string? resource, string? action, bool? isActive, bool? isDelegable,
        int page, int pageSize, CancellationToken cancellationToken);
    Task<PermissionDetailDto> GetPermissionAsync(Guid permissionId, CancellationToken cancellationToken);
    Task<PermissionDetailDto> UpdatePermissionAsync(
        Guid permissionId, UpdatePermissionRequest request, Guid actorUserId, CancellationToken cancellationToken);

    Task<PagedAuthorizationResult<RoleSummaryDto>> GetRolesAsync(
        string? search, bool? isSystem, bool? isActive, int page, int pageSize,
        CancellationToken cancellationToken);
    Task<RoleDetailDto> GetRoleAsync(Guid roleId, CancellationToken cancellationToken);
    Task<RoleDetailDto> CreateRoleAsync(
        CreateRoleRequest request, Guid actorUserId, CancellationToken cancellationToken);
    Task<RoleDetailDto> UpdateRoleAsync(
        Guid roleId, UpdateRoleRequest request, Guid actorUserId, CancellationToken cancellationToken);
    Task<RoleDetailDto> DeleteRoleAsync(
        Guid roleId, DeleteRoleRequest request, Guid actorUserId, CancellationToken cancellationToken);
    Task<RoleDetailDto> ReplaceRolePermissionsAsync(
        Guid roleId, ReplaceRolePermissionsRequest request, Guid actorUserId,
        CancellationToken cancellationToken);

    Task<UserAuthorizationDto> GetUserAuthorizationAsync(Guid userId, CancellationToken cancellationToken);
    Task<UserAuthorizationDto> AssignUserRoleAsync(
        Guid userId, AssignUserRoleRequest request, Guid actorUserId, CancellationToken cancellationToken);
    Task<UserAuthorizationDto> RevokeUserRoleAsync(
        Guid userId, Guid roleId, RevokeUserRoleRequest request, Guid actorUserId,
        CancellationToken cancellationToken);
}

public sealed record PagedAuthorizationResult<T>(
    IReadOnlyList<T> Items, int Page, int PageSize, int Total, int TotalPages);

public sealed record PermissionSummaryDto(
    Guid PermissionId, string Code, string Resource, string Action, string? Description,
    bool IsActive, bool IsDelegable, bool IsProtected, Guid ConcurrencyToken);

public sealed record PermissionDetailDto(
    Guid PermissionId, string Code, string Resource, string Action, string? Description,
    bool IsActive, bool IsDelegable, bool IsProtected, int CustomRoleUsageCount,
    Guid ConcurrencyToken, DateTime UpdatedAt);

public sealed record UpdatePermissionRequest(
    string? Description, bool? IsActive, Guid ConcurrencyToken, string Reason);

public sealed record RoleSummaryDto(
    Guid RoleId, string Code, string Name, string? Description, bool IsSystem,
    bool IsActive, int PermissionCount, int ActiveAssignmentCount, Guid ConcurrencyToken);

public sealed record RolePermissionDto(
    Guid PermissionId, string Code, string Resource, string Action, string? Description,
    bool IsActive, bool IsDelegable);

public sealed record RoleDetailDto(
    Guid RoleId, string Code, string Name, string? Description, bool IsSystem,
    bool IsActive, IReadOnlyList<RolePermissionDto> Permissions,
    int ActiveAssignmentCount, Guid ConcurrencyToken, DateTime UpdatedAt);

public sealed record CreateRoleRequest(string Code, string Name, string? Description);
public sealed record UpdateRoleRequest(
    string? Name, string? Description, bool? IsActive, Guid ConcurrencyToken, string Reason);
public sealed record DeleteRoleRequest(Guid ConcurrencyToken, string Reason);
public sealed record ReplaceRolePermissionsRequest(
    IReadOnlyCollection<Guid> PermissionIds, Guid ConcurrencyToken, string Reason);

public sealed record UserRoleAssignmentDto(
    Guid RoleId, string Code, string Name, bool IsSystem, string Status,
    DateTime AssignedAt, Guid? AssignedBy, string AssignmentSource,
    DateTime? RevokedAt, Guid? RevokedBy, string? RevokeReason);

public sealed record EffectivePermissionDto(
    Guid PermissionId, string Code, string Resource, string Action,
    IReadOnlyList<string> SourceRoles);

public sealed record UserAuthorizationDto(
    Guid UserId, string Email, string Status, Guid AuthorizationConcurrencyToken,
    IReadOnlyList<UserRoleAssignmentDto> Roles,
    IReadOnlyList<EffectivePermissionDto> EffectivePermissions);

public sealed record AssignUserRoleRequest(Guid RoleId, Guid ConcurrencyToken, string Reason);
public sealed record RevokeUserRoleRequest(Guid ConcurrencyToken, string Reason);
