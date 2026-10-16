using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Admin.Authorization;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Services.Admin;

public sealed class AuthorizationAdminService(
    ApplicationDbContext db,
    IAuditLogService audit,
    IUnitOfWork unitOfWork) : IAuthorizationAdminService
{
    private static readonly HashSet<string> ProtectedPermissions = new(StringComparer.OrdinalIgnoreCase)
    {
        "role.manage", "permission.manage", "user.manage", "system_config.manage", "audit.view"
    };

    public async Task<PagedAuthorizationResult<PermissionSummaryDto>> GetPermissionsAsync(
        string? search, string? resource, string? action, bool? isActive, bool? isDelegable,
        int page, int pageSize, CancellationToken cancellationToken)
    {
        ValidatePaging(ref page, ref pageSize);
        var query = db.Permissions.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Code.ToLower().Contains(term) ||
                (x.Description != null && x.Description.ToLower().Contains(term)));
        }
        if (!string.IsNullOrWhiteSpace(resource)) query = query.Where(x => x.Resource == resource.Trim());
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(x => x.Action == action.Trim());
        if (isActive.HasValue) query = query.Where(x => x.IsActive == isActive.Value);
        if (isDelegable.HasValue) query = query.Where(x => x.IsDelegable == isDelegable.Value);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderBy(x => x.Resource).ThenBy(x => x.Action)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new PermissionSummaryDto(x.PermissionId, x.Code, x.Resource, x.Action,
                x.Description, x.IsActive, x.IsDelegable, ProtectedPermissions.Contains(x.Code),
                x.ConcurrencyToken))
            .ToListAsync(cancellationToken);
        return new(rows, page, pageSize, total, Pages(total, pageSize));
    }

    public async Task<PermissionDetailDto> GetPermissionAsync(Guid permissionId, CancellationToken cancellationToken)
    {
        var permission = await db.Permissions.AsNoTracking()
            .Include(x => x.RolePermissions).ThenInclude(x => x.Role)
            .SingleOrDefaultAsync(x => x.PermissionId == permissionId, cancellationToken)
            ?? throw new NotFoundException("Permission", permissionId);
        return MapPermission(permission);
    }

    public async Task<PermissionDetailDto> UpdatePermissionAsync(
        Guid permissionId, UpdatePermissionRequest request, Guid actorUserId, CancellationToken cancellationToken)
    {
        RequireReason(request.Reason);
        var permission = await db.Permissions.Include(x => x.RolePermissions).ThenInclude(x => x.Role)
            .SingleOrDefaultAsync(x => x.PermissionId == permissionId, cancellationToken)
            ?? throw new NotFoundException("Permission", permissionId);
        EnsureToken(permission.ConcurrencyToken, request.ConcurrencyToken);
        if (request.IsActive == false && ProtectedPermissions.Contains(permission.Code))
            throw Conflict("Protected IAM permission cannot be disabled.", "PROTECTED_PERMISSION");

        var old = new { permission.Description, permission.IsActive, permission.ConcurrencyToken };
        if (request.Description is not null) permission.Description = CleanOptional(request.Description, 2000);
        if (request.IsActive.HasValue) permission.IsActive = request.IsActive.Value;
        permission.UpdatedAt = DateTime.UtcNow;
        permission.ConcurrencyToken = Guid.NewGuid();
        await AddAudit(request.IsActive.HasValue
                ? request.IsActive.Value ? AuditActions.PermissionActivated : AuditActions.PermissionDeactivated
                : AuditActions.PermissionUpdated,
            "PERMISSION", permission.PermissionId, actorUserId, old,
            new { permission.Description, permission.IsActive, permission.ConcurrencyToken, reason = request.Reason }, cancellationToken);
        await SaveAsync(cancellationToken);
        return MapPermission(permission);
    }

    public async Task<PagedAuthorizationResult<RoleSummaryDto>> GetRolesAsync(
        string? search, bool? isSystem, bool? isActive, int page, int pageSize,
        CancellationToken cancellationToken)
    {
        ValidatePaging(ref page, ref pageSize);
        var query = db.Roles.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Code.ToLower().Contains(term) || x.Name.ToLower().Contains(term));
        }
        if (isSystem.HasValue) query = query.Where(x => x.IsSystem == isSystem.Value);
        if (isActive.HasValue) query = query.Where(x => x.IsActive == isActive.Value);
        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(x => x.IsSystem).ThenBy(x => x.Code)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new RoleSummaryDto(x.RoleId, x.Code, x.Name, x.Description, x.IsSystem,
                x.IsActive, x.RolePermissions.Count, x.UserRoles.Count(y => y.Status == "ACTIVE"),
                x.ConcurrencyToken))
            .ToListAsync(cancellationToken);
        return new(rows, page, pageSize, total, Pages(total, pageSize));
    }

    public async Task<RoleDetailDto> GetRoleAsync(Guid roleId, CancellationToken cancellationToken)
    {
        var role = await LoadRoleAsync(roleId, false, cancellationToken);
        return MapRole(role);
    }

    public async Task<RoleDetailDto> CreateRoleAsync(
        CreateRoleRequest request, Guid actorUserId, CancellationToken cancellationToken)
    {
        var code = NormalizeRoleCode(request.Code);
        var name = RequireText(request.Name, nameof(request.Name), 120);
        if (await db.Roles.AnyAsync(x => x.Code == code, cancellationToken))
            throw Conflict("Role code already exists.", "ROLE_CODE_EXISTS");
        var now = DateTime.UtcNow;
        var role = new Role
        {
            RoleId = Guid.NewGuid(), Code = code, Name = name,
            Description = CleanOptional(request.Description, 2000), IsSystem = false, IsActive = true,
            CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid()
        };
        await db.Roles.AddAsync(role, cancellationToken);
        await AddAudit(AuditActions.RoleCreated, "ROLE", role.RoleId, actorUserId, null,
            new { role.Code, role.Name, role.Description, role.ConcurrencyToken }, cancellationToken);
        await SaveAsync(cancellationToken);
        return MapRole(role);
    }

    public async Task<RoleDetailDto> UpdateRoleAsync(
        Guid roleId, UpdateRoleRequest request, Guid actorUserId, CancellationToken cancellationToken)
    {
        RequireReason(request.Reason);
        var role = await LoadRoleAsync(roleId, true, cancellationToken);
        EnsureCustom(role);
        EnsureToken(role.ConcurrencyToken, request.ConcurrencyToken);
        if (request.IsActive == false && role.UserRoles.Any(x => x.Status == "ACTIVE"))
            throw Conflict("Revoke active assignments before deactivating this role.", "ROLE_IN_USE");
        var old = new { role.Name, role.Description, role.IsActive, role.ConcurrencyToken };
        if (request.Name is not null) role.Name = RequireText(request.Name, nameof(request.Name), 120);
        if (request.Description is not null) role.Description = CleanOptional(request.Description, 2000);
        if (request.IsActive.HasValue) role.IsActive = request.IsActive.Value;
        role.UpdatedAt = DateTime.UtcNow;
        role.ConcurrencyToken = Guid.NewGuid();
        await AddAudit(request.IsActive == false ? AuditActions.RoleDeactivated : AuditActions.RoleUpdated,
            "ROLE", role.RoleId, actorUserId, old,
            new { role.Name, role.Description, role.IsActive, role.ConcurrencyToken, reason = request.Reason }, cancellationToken);
        await SaveAsync(cancellationToken);
        return MapRole(role);
    }

    public Task<RoleDetailDto> DeleteRoleAsync(
        Guid roleId, DeleteRoleRequest request, Guid actorUserId, CancellationToken cancellationToken) =>
        UpdateRoleAsync(roleId, new(null, null, false, request.ConcurrencyToken, request.Reason),
            actorUserId, cancellationToken);

    public async Task<RoleDetailDto> ReplaceRolePermissionsAsync(
        Guid roleId, ReplaceRolePermissionsRequest request, Guid actorUserId,
        CancellationToken cancellationToken)
    {
        RequireReason(request.Reason);
        var role = await LoadRoleAsync(roleId, true, cancellationToken);
        EnsureCustom(role);
        EnsureToken(role.ConcurrencyToken, request.ConcurrencyToken);
        var ids = request.PermissionIds?.Distinct().ToArray() ?? [];
        if (ids.Length != (request.PermissionIds?.Count ?? 0))
            throw new BadRequestException("PermissionIds contains duplicates.", "DUPLICATE_PERMISSION_ID");
        var permissions = await db.Permissions.Where(x => ids.Contains(x.PermissionId)).ToListAsync(cancellationToken);
        if (permissions.Count != ids.Length) throw new NotFoundException("One or more permissions were not found.");
        var invalid = permissions.FirstOrDefault(x => !x.IsActive || !x.IsDelegable || ProtectedPermissions.Contains(x.Code));
        if (invalid is not null) throw Conflict($"Permission '{invalid.Code}' cannot be delegated.", "NON_DELEGABLE_PERMISSION");

        var oldIds = role.RolePermissions.Select(x => x.PermissionId).ToHashSet();
        var added = ids.Where(x => !oldIds.Contains(x)).ToArray();
        var removed = oldIds.Where(x => !ids.Contains(x)).ToArray();
        if (added.Length == 0 && removed.Length == 0) return MapRole(role);
        db.RolePermissions.RemoveRange(role.RolePermissions.Where(x => removed.Contains(x.PermissionId)));
        var now = DateTime.UtcNow;
        foreach (var id in added)
            await db.RolePermissions.AddAsync(new RolePermission
            {
                RoleId = role.RoleId, PermissionId = id, GrantedAt = now,
                GrantedBy = actorUserId, GrantSource = "ADMIN_ASSIGNMENT"
            }, cancellationToken);
        role.UpdatedAt = now;
        role.ConcurrencyToken = Guid.NewGuid();
        await AddAudit(AuditActions.RolePermissionsReplaced, "ROLE", role.RoleId, actorUserId,
            new { permissionIds = oldIds },
            new { permissionIds = ids, added, removed, role.ConcurrencyToken, reason = request.Reason }, cancellationToken);
        await SaveAsync(cancellationToken);
        return await GetRoleAsync(roleId, cancellationToken);
    }

    public async Task<UserAuthorizationDto> GetUserAuthorizationAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await LoadUserAsync(userId, false, cancellationToken);
        return MapUser(user);
    }

    public async Task<UserAuthorizationDto> AssignUserRoleAsync(
        Guid userId, AssignUserRoleRequest request, Guid actorUserId, CancellationToken cancellationToken)
    {
        RequireReason(request.Reason);
        EnsureNotSelf(userId, actorUserId);
        var user = await LoadUserAsync(userId, true, cancellationToken);
        EnsureToken(user.AuthorizationConcurrencyToken, request.ConcurrencyToken);
        if (user.Status != "ACTIVE") throw Conflict("Only an active user can receive a role.", "USER_INACTIVE");
        var role = await db.Roles.SingleOrDefaultAsync(x => x.RoleId == request.RoleId, cancellationToken)
            ?? throw new NotFoundException("Role", request.RoleId);
        EnsureCustom(role);
        if (!role.IsActive) throw Conflict("Role is inactive.", "ROLE_INACTIVE");
        var existing = user.UserRoleUsers.SingleOrDefault(x => x.RoleId == role.RoleId);
        if (existing?.Status == "ACTIVE") return MapUser(user);
        var now = DateTime.UtcNow;
        if (existing is null)
        {
            existing = new UserRole { UserId = user.UserId, RoleId = role.RoleId };
            user.UserRoleUsers.Add(existing);
        }
        existing.Status = "ACTIVE";
        existing.AssignedAt = now;
        existing.AssignedBy = actorUserId;
        existing.AssignmentSource = "ADMIN_ASSIGNMENT";
        existing.RevokedAt = null; existing.RevokedBy = null; existing.RevokeReason = null;
        user.AuthorizationConcurrencyToken = Guid.NewGuid();
        user.UpdatedAt = now;
        await AddAudit(AuditActions.UserRoleAssigned, "APP_USER", user.UserId, actorUserId, null,
            new { role.RoleId, role.Code, user.AuthorizationConcurrencyToken, reason = request.Reason }, cancellationToken);
        await SaveAsync(cancellationToken);
        return await GetUserAuthorizationAsync(userId, cancellationToken);
    }

    public async Task<UserAuthorizationDto> RevokeUserRoleAsync(
        Guid userId, Guid roleId, RevokeUserRoleRequest request, Guid actorUserId,
        CancellationToken cancellationToken)
    {
        RequireReason(request.Reason);
        EnsureNotSelf(userId, actorUserId);
        var user = await LoadUserAsync(userId, true, cancellationToken);
        EnsureToken(user.AuthorizationConcurrencyToken, request.ConcurrencyToken);
        var assignment = user.UserRoleUsers.SingleOrDefault(x => x.RoleId == roleId)
            ?? throw new NotFoundException("UserRole", $"{userId}/{roleId}");
        EnsureCustom(assignment.Role);
        if (assignment.Status == "REVOKED") return MapUser(user);
        var now = DateTime.UtcNow;
        assignment.Status = "REVOKED";
        assignment.RevokedAt = now; assignment.RevokedBy = actorUserId;
        assignment.RevokeReason = RequireText(request.Reason, nameof(request.Reason), 2000);
        user.AuthorizationConcurrencyToken = Guid.NewGuid();
        user.UpdatedAt = now;
        await AddAudit(AuditActions.UserRoleRevoked, "APP_USER", user.UserId, actorUserId,
            new { assignment.RoleId, assignment.Role.Code, status = "ACTIVE" },
            new { assignment.RoleId, assignment.Role.Code, status = "REVOKED", user.AuthorizationConcurrencyToken, reason = request.Reason }, cancellationToken);
        await SaveAsync(cancellationToken);
        return await GetUserAuthorizationAsync(userId, cancellationToken);
    }

    private async Task<Role> LoadRoleAsync(Guid id, bool tracked, CancellationToken cancellationToken)
    {
        IQueryable<Role> query = db.Roles.Include(x => x.RolePermissions).ThenInclude(x => x.Permission)
            .Include(x => x.UserRoles);
        if (!tracked) query = query.AsNoTracking();
        return await query.SingleOrDefaultAsync(x => x.RoleId == id, cancellationToken)
            ?? throw new NotFoundException("Role", id);
    }

    private async Task<AppUser> LoadUserAsync(Guid id, bool tracked, CancellationToken cancellationToken)
    {
        IQueryable<AppUser> query = db.AppUsers
            .Include(x => x.UserRoleUsers).ThenInclude(x => x.Role)
                .ThenInclude(x => x.RolePermissions).ThenInclude(x => x.Permission);
        if (!tracked) query = query.AsNoTracking();
        return await query.SingleOrDefaultAsync(x => x.UserId == id, cancellationToken)
            ?? throw new NotFoundException("AppUser", id);
    }

    private static PermissionDetailDto MapPermission(Permission x) => new(
        x.PermissionId, x.Code, x.Resource, x.Action, x.Description, x.IsActive, x.IsDelegable,
        ProtectedPermissions.Contains(x.Code),
        x.RolePermissions.Count(rp => !rp.Role.IsSystem && rp.Role.IsActive), x.ConcurrencyToken, x.UpdatedAt);

    private static RoleDetailDto MapRole(Role x) => new(
        x.RoleId, x.Code, x.Name, x.Description, x.IsSystem, x.IsActive,
        x.RolePermissions.OrderBy(y => y.Permission.Code).Select(y => new RolePermissionDto(
            y.Permission.PermissionId, y.Permission.Code, y.Permission.Resource, y.Permission.Action,
            y.Permission.Description, y.Permission.IsActive, y.Permission.IsDelegable)).ToList(),
        x.UserRoles.Count(y => y.Status == "ACTIVE"), x.ConcurrencyToken, x.UpdatedAt);

    private static UserAuthorizationDto MapUser(AppUser x)
    {
        var roles = x.UserRoleUsers.OrderBy(y => y.Role.Code).Select(y => new UserRoleAssignmentDto(
            y.RoleId, y.Role.Code, y.Role.Name, y.Role.IsSystem, y.Status, y.AssignedAt,
            y.AssignedBy, y.AssignmentSource, y.RevokedAt, y.RevokedBy, y.RevokeReason)).ToList();
        var effective = x.UserRoleUsers
            .Where(y => y.Status == "ACTIVE" && y.Role.IsActive)
            .SelectMany(y => y.Role.RolePermissions.Where(rp => rp.Permission.IsActive)
                .Select(rp => new { rp.Permission, RoleCode = y.Role.Code }))
            .GroupBy(y => new { y.Permission.PermissionId, y.Permission.Code, y.Permission.Resource, y.Permission.Action })
            .OrderBy(g => g.Key.Code)
            .Select(g => new EffectivePermissionDto(g.Key.PermissionId, g.Key.Code, g.Key.Resource,
                g.Key.Action, g.Select(y => y.RoleCode).Distinct().OrderBy(y => y).ToList()))
            .ToList();
        return new(x.UserId, x.Email, x.Status, x.AuthorizationConcurrencyToken, roles, effective);
    }

    private async Task AddAudit(string action, string entityType, Guid entityId, Guid actor,
        object? oldValues, object? newValues, CancellationToken cancellationToken) =>
        await audit.AddAsync(new AuditEntry { Action = action, EntityType = entityType,
            EntityId = entityId, ActorUserId = actor, OldValues = oldValues, NewValues = newValues }, cancellationToken);

    private async Task SaveAsync(CancellationToken cancellationToken)
    {
        try { await unitOfWork.SaveChangesAsync(cancellationToken); }
        catch (ConflictException ex) when (ex.ErrorCode == "CONCURRENT_UPDATE")
        { throw Conflict("Authorization data changed. Reload and try again.", "RBAC_CONCURRENCY_CONFLICT", ex); }
        catch (DbUpdateConcurrencyException ex)
        { throw Conflict("Authorization data changed. Reload and try again.", "RBAC_CONCURRENCY_CONFLICT", ex); }
    }

    private static void EnsureToken(Guid current, Guid expected)
    {
        if (expected == Guid.Empty || current != expected)
            throw Conflict("Authorization data changed. Reload and try again.", "RBAC_CONCURRENCY_CONFLICT");
    }
    private static void EnsureCustom(Role role)
    {
        if (role.IsSystem) throw Conflict("System roles are managed by their business workflows.", "SYSTEM_ROLE_IMMUTABLE");
    }
    private static void EnsureNotSelf(Guid target, Guid actor)
    {
        if (target == actor) throw new ForbiddenException("You cannot change your own role assignments.", "SELF_ROLE_MUTATION_FORBIDDEN");
    }
    private static void RequireReason(string? value) => RequireText(value, "Reason", 2000);
    private static string RequireText(string? value, string name, int max)
    {
        var result = value?.Trim();
        if (string.IsNullOrWhiteSpace(result)) throw new BadRequestException($"{name} is required.", "VALIDATION_ERROR");
        if (result.Length > max) throw new BadRequestException($"{name} must not exceed {max} characters.", "VALIDATION_ERROR");
        return result;
    }
    private static string? CleanOptional(string? value, int max)
    {
        var result = value?.Trim();
        if (result?.Length > max) throw new BadRequestException($"Value must not exceed {max} characters.", "VALIDATION_ERROR");
        return string.IsNullOrWhiteSpace(result) ? null : result;
    }
    private static string NormalizeRoleCode(string? value)
    {
        var result = RequireText(value, "Code", 60).ToUpperInvariant().Replace('-', '_').Replace(' ', '_');
        if (result.Any(c => !(char.IsAsciiLetterUpper(c) || char.IsDigit(c) || c == '_')))
            throw new BadRequestException("Role code may contain only A-Z, 0-9 and underscore.", "VALIDATION_ERROR");
        return result;
    }
    private static void ValidatePaging(ref int page, ref int pageSize)
    {
        if (page < 1) page = 1;
        pageSize = Math.Clamp(pageSize, 1, 100);
    }
    private static int Pages(int total, int pageSize) => (int)Math.Ceiling(total / (double)pageSize);
    private static ConflictException Conflict(string message, string code, Exception? inner = null) => new(message, code, inner);
}
