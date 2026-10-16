using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Admin.Authorization;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Admin;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace HRConnect.UnitTests.Services.Admin;

public sealed class AuthorizationAdminServiceTests : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly AuthorizationAdminService _service;

    public AuthorizationAdminServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new ApplicationDbContext(options);
        _service = new AuthorizationAdminService(_db, _audit.Object, new UnitOfWork(_db));
    }

    [Fact]
    public async Task UpdatePermissionAsync_RejectsDisablingProtectedPermission()
    {
        var permission = Permission("role.manage", delegable: false);
        await Save(permission);

        var action = () => _service.UpdatePermissionAsync(permission.PermissionId,
            new UpdatePermissionRequest(null, false, permission.ConcurrencyToken, "Không còn sử dụng"),
            Guid.NewGuid(), default);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("PROTECTED_PERMISSION");
        (await _db.Permissions.FindAsync(permission.PermissionId))!.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateRoleAsync_RejectsSystemRole()
    {
        var role = Role("CANDIDATE", system: true);
        await Save(role);

        var action = () => _service.UpdateRoleAsync(role.RoleId,
            new UpdateRoleRequest("Ứng viên", null, null, role.ConcurrencyToken, "Đổi tên"),
            Guid.NewGuid(), default);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("SYSTEM_ROLE_IMMUTABLE");
    }

    [Fact]
    public async Task ReplaceRolePermissionsAsync_RejectsNonDelegablePermission()
    {
        var role = Role("CUSTOM_REVIEWER");
        var permission = Permission("audit.view", delegable: false);
        await Save(role, permission);

        var action = () => _service.ReplaceRolePermissionsAsync(role.RoleId,
            new ReplaceRolePermissionsRequest([permission.PermissionId], role.ConcurrencyToken, "Cấp quyền"),
            Guid.NewGuid(), default);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("NON_DELEGABLE_PERMISSION");
        (await _db.RolePermissions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ReplaceRolePermissionsAsync_ReplacesMatrixAndRotatesToken()
    {
        var role = Role("CUSTOM_REVIEWER");
        var oldPermission = Permission("job.view");
        var newPermission = Permission("candidate.view");
        var oldLink = Link(role, oldPermission);
        await Save(role, oldPermission, newPermission, oldLink);
        var originalToken = role.ConcurrencyToken;

        var result = await _service.ReplaceRolePermissionsAsync(role.RoleId,
            new ReplaceRolePermissionsRequest([newPermission.PermissionId], originalToken, "Điều chỉnh nhiệm vụ"),
            Guid.NewGuid(), default);

        result.Permissions.Select(x => x.Code).Should().Equal("candidate.view");
        result.ConcurrencyToken.Should().NotBe(originalToken);
        (await _db.RolePermissions.SingleAsync()).PermissionId.Should().Be(newPermission.PermissionId);
        _audit.Verify(x => x.AddAsync(
            It.Is<AuditEntry>(a => a.Action == AuditActions.RolePermissionsReplaced),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AssignRevokeAndReactivateRole_MaintainsLifecycleAndRotatesUserToken()
    {
        var actorId = Guid.NewGuid();
        var user = User();
        var role = Role("CUSTOM_REVIEWER");
        await Save(user, role);
        var firstToken = user.AuthorizationConcurrencyToken;

        var assigned = await _service.AssignUserRoleAsync(user.UserId,
            new AssignUserRoleRequest(role.RoleId, firstToken, "Phân công kiểm duyệt"), actorId, default);
        assigned.AuthorizationConcurrencyToken.Should().NotBe(firstToken);
        var assignment = await _db.UserRoles.SingleAsync();
        assignment.Status.Should().Be("ACTIVE");
        assignment.AssignedBy.Should().Be(actorId);
        assignment.RevokedAt.Should().BeNull();

        var revoked = await _service.RevokeUserRoleAsync(user.UserId, role.RoleId,
            new RevokeUserRoleRequest(assigned.AuthorizationConcurrencyToken, "Kết thúc phân công"), actorId, default);
        revoked.AuthorizationConcurrencyToken.Should().NotBe(assigned.AuthorizationConcurrencyToken);
        assignment.Status.Should().Be("REVOKED");
        assignment.RevokedAt.Should().NotBeNull();
        assignment.RevokedBy.Should().Be(actorId);
        assignment.RevokeReason.Should().Be("Kết thúc phân công");

        var reactivated = await _service.AssignUserRoleAsync(user.UserId,
            new AssignUserRoleRequest(role.RoleId, revoked.AuthorizationConcurrencyToken, "Phân công lại"), actorId, default);
        reactivated.AuthorizationConcurrencyToken.Should().NotBe(revoked.AuthorizationConcurrencyToken);
        assignment.Status.Should().Be("ACTIVE");
        assignment.RevokedAt.Should().BeNull();
        assignment.RevokedBy.Should().BeNull();
        assignment.RevokeReason.Should().BeNull();
        assignment.AssignmentSource.Should().Be("ADMIN_ASSIGNMENT");
    }

    [Fact]
    public async Task AssignUserRoleAsync_RejectsStaleTokenBeforeIdempotentReturn()
    {
        var user = User();
        var role = Role("CUSTOM_REVIEWER");
        var assignment = Assignment(user, role);
        await Save(user, role, assignment);

        var action = () => _service.AssignUserRoleAsync(user.UserId,
            new AssignUserRoleRequest(role.RoleId, Guid.NewGuid(), "Gán lại"), Guid.NewGuid(), default);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("RBAC_CONCURRENCY_CONFLICT");
    }

    [Fact]
    public async Task AssignUserRoleAsync_RejectsSelfMutation()
    {
        var user = User();
        var role = Role("CUSTOM_REVIEWER");
        await Save(user, role);

        var action = () => _service.AssignUserRoleAsync(user.UserId,
            new AssignUserRoleRequest(role.RoleId, user.AuthorizationConcurrencyToken, "Tự cấp"),
            user.UserId, default);

        var error = await action.Should().ThrowAsync<ForbiddenException>();
        error.Which.ErrorCode.Should().Be("SELF_ROLE_MUTATION_FORBIDDEN");
    }

    [Fact]
    public async Task GetUserAuthorizationAsync_DeduplicatesEffectivePermissionAndListsSources()
    {
        var user = User();
        var roleA = Role("CUSTOM_A");
        var roleB = Role("CUSTOM_B");
        var permission = Permission("job.view");
        await Save(user, roleA, roleB, permission,
            Link(roleA, permission), Link(roleB, permission),
            Assignment(user, roleA), Assignment(user, roleB));

        var result = await _service.GetUserAuthorizationAsync(user.UserId, default);

        result.EffectivePermissions.Should().ContainSingle();
        result.EffectivePermissions[0].Code.Should().Be("job.view");
        result.EffectivePermissions[0].SourceRoles.Should().Equal("CUSTOM_A", "CUSTOM_B");
    }

    [Fact]
    public async Task DeleteRoleAsync_RejectsRoleWithActiveAssignment()
    {
        var user = User();
        var role = Role("CUSTOM_REVIEWER");
        await Save(user, role, Assignment(user, role));

        var action = () => _service.DeleteRoleAsync(role.RoleId,
            new DeleteRoleRequest(role.ConcurrencyToken, "Ngừng vai trò"), Guid.NewGuid(), default);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("ROLE_IN_USE");
        role.IsActive.Should().BeTrue();
    }

    private async Task Save(params object[] entities)
    {
        _db.AddRange(entities);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
    }

    private static AppUser User() => new()
    {
        UserId = Guid.NewGuid(), Email = $"{Guid.NewGuid():N}@example.com", PasswordHash = "hash",
        Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        AuthorizationConcurrencyToken = Guid.NewGuid()
    };

    private static Role Role(string code, bool system = false) => new()
    {
        RoleId = Guid.NewGuid(), Code = code, Name = code, IsSystem = system, IsActive = true,
        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, ConcurrencyToken = Guid.NewGuid()
    };

    private static Permission Permission(string code, bool delegable = true)
    {
        var separator = code.IndexOf('.');
        return new Permission
        {
            PermissionId = Guid.NewGuid(), Code = code,
            Resource = separator > 0 ? code[..separator] : code,
            Action = separator > 0 ? code[(separator + 1)..] : "manage",
            IsActive = true, IsDelegable = delegable,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid()
        };
    }

    private static RolePermission Link(Role role, Permission permission) => new()
    {
        RoleId = role.RoleId, PermissionId = permission.PermissionId,
        GrantedAt = DateTime.UtcNow, GrantSource = "SYSTEM_MIGRATION"
    };

    private static UserRole Assignment(AppUser user, Role role) => new()
    {
        UserId = user.UserId, RoleId = role.RoleId, Status = "ACTIVE",
        AssignmentSource = "ADMIN_ASSIGNMENT", AssignedAt = DateTime.UtcNow
    };

    public void Dispose() => _db.Dispose();
}
