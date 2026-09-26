using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IAuditLogRepository
{
    Task<(IReadOnlyList<AuditLog> Items, int TotalCount)> GetListAsync(
        Guid? actorUserId,
        string? action,
        string? entityType,
        Guid? entityId,
        Guid? correlationId,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
