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
}
