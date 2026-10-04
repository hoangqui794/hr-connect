using System.Text.Json;
using System.Text.Json.Nodes;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;

namespace HRConnect.Infrastructure.Services.Audit;

public sealed class AuditLogService : IAuditLogService
{
    private const int MaxJsonLength = 16_384;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string[] SensitiveKeyFragments =
    [
        "password", "otp", "token", "secret", "authorization", "cookie",
        "presigned", "cvcontent", "rawtext"
    ];

    private readonly ApplicationDbContext _dbContext;
    private readonly IRequestContext _requestContext;

    public AuditLogService(ApplicationDbContext dbContext, IRequestContext requestContext)
    {
        _dbContext = dbContext;
        _requestContext = requestContext;
    }

    public async Task AddAsync(AuditEntry entry, CancellationToken cancellationToken = default)
    {
        var action = entry.Action?.Trim();
        if (string.IsNullOrWhiteSpace(action) || action.Length > 120)
        {
            throw new ArgumentException("Audit action is required and must not exceed 120 characters.", nameof(entry));
        }

        var entityType = entry.EntityType?.Trim();
        if (entityType?.Length > 80)
        {
            throw new ArgumentException("Audit entity type must not exceed 80 characters.", nameof(entry));
        }

        var actorUserId = entry.ActorUserId ?? _requestContext.UserId;
        var hasRequestContext = _requestContext.CorrelationId.HasValue ||
            _requestContext.IpAddress != null || !string.IsNullOrWhiteSpace(_requestContext.UserAgent);
        var actorType = NormalizeContextValue(
            entry.ActorType,
            actorUserId.HasValue
                ? AuditActorTypes.User
                : hasRequestContext ? AuditActorTypes.Anonymous : AuditActorTypes.System,
            AuditActorTypes.All,
            nameof(entry.ActorType));
        if (actorType == AuditActorTypes.User && !actorUserId.HasValue)
        {
            throw new ArgumentException("USER audit actor requires ActorUserId.", nameof(entry));
        }
        if (actorType != AuditActorTypes.User && actorUserId.HasValue)
        {
            throw new ArgumentException("An audit ActorUserId must use actor type USER.", nameof(entry));
        }

        var source = NormalizeContextValue(
            entry.Source,
            hasRequestContext
                ? AuditSources.Api
                : actorUserId.HasValue ? AuditSources.Application : AuditSources.BackgroundWorker,
            AuditSources.All,
            nameof(entry.Source));
        var serviceName = entry.ServiceName?.Trim();
        if (serviceName?.Length > 80)
        {
            throw new ArgumentException("Audit service name must not exceed 80 characters.", nameof(entry));
        }
        if (actorType == AuditActorTypes.Service && string.IsNullOrWhiteSpace(serviceName))
        {
            throw new ArgumentException("SERVICE audit actor requires ServiceName.", nameof(entry));
        }
        if (entry.EventVersion < 1)
        {
            throw new ArgumentException("Audit event version must be at least 1.", nameof(entry));
        }

        await _dbContext.AuditLogs.AddAsync(new AuditLog
        {
            ActorUserId = actorUserId,
            ActorType = actorType,
            Action = action,
            EntityType = entityType,
            EntityId = entry.EntityId,
            OldValues = SerializeSafe(entry.OldValues),
            NewValues = SerializeSafe(entry.NewValues),
            CorrelationId = entry.CorrelationId ?? _requestContext.CorrelationId,
            Source = source,
            ServiceName = serviceName,
            EventVersion = entry.EventVersion,
            IpAddress = _requestContext.IpAddress,
            UserAgent = _requestContext.UserAgent,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);
    }

    private static string NormalizeContextValue(
        string? value,
        string fallback,
        IReadOnlySet<string> allowed,
        string parameterName)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim().ToUpperInvariant();
        if (!allowed.Contains(normalized))
        {
            throw new ArgumentException($"Unsupported audit context value '{normalized}'.", parameterName);
        }

        return normalized;
    }

    private static string? SerializeSafe(object? value)
    {
        if (value == null) return null;

        var node = JsonSerializer.SerializeToNode(value, JsonOptions);
        Redact(node);
        var json = node?.ToJsonString(JsonOptions);
        if (json?.Length > MaxJsonLength)
        {
            throw new ArgumentException($"Audit JSON must not exceed {MaxJsonLength} characters.");
        }

        return json;
    }

    private static void Redact(JsonNode? node)
    {
        if (node is JsonObject jsonObject)
        {
            foreach (var property in jsonObject.ToList())
            {
                if (SensitiveKeyFragments.Any(fragment =>
                        property.Key.Contains(fragment, StringComparison.OrdinalIgnoreCase)))
                {
                    jsonObject[property.Key] = "[REDACTED]";
                }
                else
                {
                    Redact(property.Value);
                }
            }
        }
        else if (node is JsonArray jsonArray)
        {
            foreach (var child in jsonArray)
            {
                Redact(child);
            }
        }
    }
}
