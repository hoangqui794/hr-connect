using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Admin.Users;

public sealed class AdminUserListItemDto
{
    public Guid UserId { get; init; }
    public required string Email { get; init; }
    public string? DisplayName { get; init; }
    public required string Status { get; init; }
    public required IReadOnlyList<string> Roles { get; init; }
    public bool IsLoginLocked { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    internal static AdminUserListItemDto From(AppUser user, DateTime nowUtc) => new()
    {
        UserId = user.UserId,
        Email = user.Email,
        DisplayName = user.DisplayName,
        Status = user.Status,
        Roles = ActiveRoles(user),
        IsLoginLocked = user.LockoutEndAt.HasValue && user.LockoutEndAt.Value > nowUtc,
        LastLoginAt = user.LastLoginAt,
        CreatedAt = user.CreatedAt,
        UpdatedAt = user.UpdatedAt
    };

    internal static IReadOnlyList<string> ActiveRoles(AppUser user) => user.UserRoleUsers
        .Where(assignment =>
            string.Equals(assignment.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            assignment.Role.IsActive)
        .Select(assignment => assignment.Role.Code)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(code => code, StringComparer.OrdinalIgnoreCase)
        .ToList();
}

public sealed class AdminUserDetailDto
{
    public Guid UserId { get; init; }
    public required string Email { get; init; }
    public string? DisplayName { get; init; }
    public string? Phone { get; init; }
    public string? AvatarUrl { get; init; }
    public required string Status { get; init; }
    public required IReadOnlyList<string> Roles { get; init; }
    public bool IsEmailVerified { get; init; }
    public bool IsLoginLocked { get; init; }
    public int FailedLoginAttempts { get; init; }
    public DateTime? LockoutEndAt { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    internal static AdminUserDetailDto From(AppUser user, DateTime nowUtc) => new()
    {
        UserId = user.UserId,
        Email = user.Email,
        DisplayName = user.DisplayName,
        Phone = user.Phone,
        AvatarUrl = user.AvatarUrl,
        Status = user.Status,
        Roles = AdminUserListItemDto.ActiveRoles(user),
        IsEmailVerified = user.EmailVerifiedAt.HasValue,
        IsLoginLocked = user.LockoutEndAt.HasValue && user.LockoutEndAt.Value > nowUtc,
        FailedLoginAttempts = user.FailedLoginAttempts,
        LockoutEndAt = user.LockoutEndAt,
        LastLoginAt = user.LastLoginAt,
        CreatedAt = user.CreatedAt,
        UpdatedAt = user.UpdatedAt
    };
}

public sealed class AdminUserListResponse
{
    public bool Success { get; init; } = true;
    public required AdminUserListData Data { get; init; }
}

public sealed class AdminUserListData
{
    public required IReadOnlyList<AdminUserListItemDto> Items { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int Total { get; init; }
    public int TotalPages { get; init; }
}

public sealed class AdminUserDetailResponse
{
    public bool Success { get; init; } = true;
    public required AdminUserDetailDto Data { get; init; }
}

public sealed class AdminUserActionResponse
{
    public bool Success { get; init; } = true;
    public required string Message { get; init; }
    public required AdminUserDetailDto Data { get; init; }
}
