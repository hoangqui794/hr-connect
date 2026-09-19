namespace HRConnect.Application.Common.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }

    string? Email { get; }

    bool IsAuthenticated { get; }

    bool HasRole(string role);

    bool HasPermission(string permission);
}
