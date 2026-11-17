namespace HRConnect.Domain.Constants;

/// <summary>The five system roles seeded by DatabaseSeeder (roles.code).</summary>
public static class RoleCodes
{
    public const string Candidate = "CANDIDATE";
    public const string Affiliate = "AFFILIATE";
    public const string ClientCompanyUser = "CLIENT_COMPANY_USER";
    public const string InternalHr = "INTERNAL_HR";
    public const string PlatformAdmin = "PLATFORM_ADMIN";

    public static readonly string[] All = [Candidate, Affiliate, ClientCompanyUser, InternalHr, PlatformAdmin];
}

/// <summary>app_user.status values (see GetAdminUsersQuery allowed statuses).</summary>
public static class UserAccountStates
{
    public const string Pending = "PENDING";
    public const string Active = "ACTIVE";
    public const string Suspended = "SUSPENDED";
    public const string Locked = "LOCKED";
    public const string Rejected = "REJECTED";
}

/// <summary>user_role.status: only ACTIVE assignments grant a role (UserRepository.GetAuthorizationSnapshotAsync).</summary>
public static class UserRoleAssignmentStates
{
    public const string Active = "ACTIVE";
}
