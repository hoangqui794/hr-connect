namespace HRConnect.Application.Common.Interfaces;

/// <summary>Content of an in-app notification; RouteHint is where the bell click should take the user.</summary>
public sealed record AppNotice(
    string NotificationType,
    string Title,
    string Message,
    string RelatedEntityType,
    Guid RelatedEntityId,
    string? RouteHint = null);

/// <summary>
/// Adds bell notifications to the current unit of work (the caller saves). They are pushed over SignalR
/// after the commit by the notification interceptor, so a rolled-back action never notifies anyone.
/// </summary>
public interface IAppNotifier
{
    Task NotifyUsersAsync(IEnumerable<Guid> userIds, AppNotice notice, CancellationToken cancellationToken = default);

    /// <summary>Every active user holding the active role (e.g. INTERNAL_HR, PLATFORM_ADMIN).</summary>
    Task NotifyRoleAsync(string roleCode, AppNotice notice, CancellationToken cancellationToken = default);

    /// <summary>Every active member of the company.</summary>
    Task NotifyCompanyAsync(Guid companyId, AppNotice notice, CancellationToken cancellationToken = default);
}
