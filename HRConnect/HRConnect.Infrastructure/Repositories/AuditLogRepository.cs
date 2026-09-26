using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class AuditLogRepository : IAuditLogRepository
{
    private readonly ApplicationDbContext _context;

    public AuditLogRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<AuditLog> Items, int TotalCount)> GetListAsync(
        Guid? actorUserId,
        string? action,
        string? entityType,
        Guid? entityId,
        Guid? correlationId,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AuditLogs
            .AsNoTracking()
            .Include(log => log.ActorUser)
            .AsQueryable();

        if (actorUserId.HasValue)
            query = query.Where(log => log.ActorUserId == actorUserId);
        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(log => log.Action == action);
        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(log => log.EntityType == entityType);
        if (entityId.HasValue)
            query = query.Where(log => log.EntityId == entityId);
        if (correlationId.HasValue)
            query = query.Where(log => log.CorrelationId == correlationId);
        if (fromUtc.HasValue)
            query = query.Where(log => log.CreatedAt >= fromUtc.Value);
        if (toUtc.HasValue)
            query = query.Where(log => log.CreatedAt <= toUtc.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(log => log.CreatedAt)
            .ThenByDescending(log => log.AuditLogId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }
}
