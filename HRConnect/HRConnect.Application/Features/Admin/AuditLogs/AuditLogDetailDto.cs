using System.Text.Json;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Admin.AuditLogs;

public sealed class AuditLogDetailDto
{
    public long AuditLogId { get; init; }

    public Guid? ActorUserId { get; init; }

    public required string ActorType { get; init; }

    public string? ActorDisplayName { get; init; }

    public string? ActorEmail { get; init; }

    public required string Action { get; init; }

    public required string Source { get; init; }

    public string? ServiceName { get; init; }

    public int EventVersion { get; init; }

    public string? EntityType { get; init; }

    public Guid? EntityId { get; init; }

    public JsonElement? OldValues { get; init; }

    public JsonElement? NewValues { get; init; }

    public Guid? CorrelationId { get; init; }

    public string? IpAddress { get; init; }

    public string? UserAgent { get; init; }

    public DateTime CreatedAt { get; init; }

    internal static AuditLogDetailDto From(AuditLog log) => new()
    {
        AuditLogId = log.AuditLogId,
        ActorUserId = log.ActorUserId,
        ActorType = log.ActorType,
        ActorDisplayName = log.ActorUser?.DisplayName,
        ActorEmail = log.ActorUser?.Email,
        Action = log.Action,
        Source = log.Source,
        ServiceName = log.ServiceName,
        EventVersion = log.EventVersion,
        EntityType = log.EntityType,
        EntityId = log.EntityId,
        OldValues = ParseJson(log.OldValues),
        NewValues = ParseJson(log.NewValues),
        CorrelationId = log.CorrelationId,
        IpAddress = log.IpAddress?.ToString(),
        UserAgent = log.UserAgent,
        CreatedAt = log.CreatedAt
    };

    private static JsonElement? ParseJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
