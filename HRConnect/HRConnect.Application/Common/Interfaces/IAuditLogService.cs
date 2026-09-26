using HRConnect.Application.Common.Models;

namespace HRConnect.Application.Common.Interfaces;

public interface IAuditLogService
{
    /// <summary>
    /// Adds an append-only audit event to the current unit of work. The caller must
    /// commit through IUnitOfWork so the audit and business change are atomic.
    /// </summary>
    Task AddAsync(AuditEntry entry, CancellationToken cancellationToken = default);
}
