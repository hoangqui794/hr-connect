namespace HRConnect.Application.Common.Models;

public sealed class AuditEntry
{
    public required string Action { get; init; }

    public string? EntityType { get; init; }

    public Guid? EntityId { get; init; }

    public object? OldValues { get; init; }

    public object? NewValues { get; init; }

    public Guid? ActorUserId { get; init; }

    public Guid? CorrelationId { get; init; }

    public string? ActorType { get; init; }

    public string? Source { get; init; }

    public string? ServiceName { get; init; }

    public int EventVersion { get; init; } = 1;
}
