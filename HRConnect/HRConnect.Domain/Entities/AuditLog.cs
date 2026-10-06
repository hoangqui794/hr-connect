using System;
using System.Collections.Generic;
using System.Net;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Append-only audit trail. Set hr_connect.current_user_id in the application transaction when actor identity is available.
/// </summary>
public partial class AuditLog
{
    public long AuditLogId { get; set; }

    public Guid? ActorUserId { get; set; }

    public string ActorType { get; set; } = "SYSTEM";

    public string Action { get; set; } = null!;

    public string? EntityType { get; set; }

    public Guid? EntityId { get; set; }

    public string? OldValues { get; set; }

    public string? NewValues { get; set; }

    public Guid? CorrelationId { get; set; }

    public string Source { get; set; } = "APPLICATION";

    public string? ServiceName { get; set; }

    public int EventVersion { get; set; } = 1;

    public IPAddress? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AppUser? ActorUser { get; set; }
}

