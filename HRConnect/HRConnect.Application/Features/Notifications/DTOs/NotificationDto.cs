using System;
using System.Collections.Generic;
using System.Text.Json;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Notifications.DTOs;

public sealed record NotificationDto(
    Guid NotificationId,
    string NotificationType,
    string Title,
    string Message,
    string? RelatedEntityType,
    Guid? RelatedEntityId,
    string? RouteHint,
    bool IsRead,
    DateTime? ReadAt,
    DateTime CreatedAt,
    string? Metadata)
{
    public static NotificationDto From(Notification notification) => new(
        notification.NotificationId,
        notification.NotificationType,
        notification.Title,
        notification.Message,
        notification.RelatedEntityType,
        notification.RelatedEntityId,
        ResolveRouteHint(notification.RelatedEntityType, notification.RelatedEntityId, notification.Metadata),
        notification.IsRead,
        notification.ReadAt,
        notification.CreatedAt,
        notification.Metadata);

    private static string? ResolveRouteHint(string? entityType, Guid? entityId, string? metadata)
    {
        if (string.IsNullOrWhiteSpace(entityType)) return null;

        var explicitRoute = TryReadString(metadata, "routeHint") ?? TryReadString(metadata, "actionRoute");
        if (!string.IsNullOrWhiteSpace(explicitRoute) && explicitRoute.StartsWith('/'))
        {
            return explicitRoute;
        }

        return entityType.Trim().ToUpperInvariant() switch
        {
            "JOB" => entityId.HasValue ? $"/jobs/{entityId.Value}" : "/jobs",
            "SERVICE_AGREEMENT" => TryReadString(metadata, "status") == "CHANGE_REQUESTED"
                ? (TryReadGuid(metadata, "jobId") is { } changeJobId
                    ? $"/hr/jobs?status=CHANGE_REQUESTED&highlight={changeJobId}"
                    : "/hr/jobs?status=CHANGE_REQUESTED")
                : (TryReadGuid(metadata, "jobId") is { } agreementJobId
                    ? $"/hr/jobs?status=PENDING_AGREEMENT&highlight={agreementJobId}"
                    : "/hr/jobs?status=PENDING_AGREEMENT"),
            "APPLICATION" or "APPLICATION_STATUS" or "CANDIDATE_APPLICATION" => "/candidate/applications",
            "SUBMISSION" or "SUBMISSION_CONSENT_RESULT" => "/affiliate/submissions",
            "INTERVIEW" => ResolveInterviewRoute(entityId, metadata),
            "OFFER" => ResolveOfferRoute(metadata),
            "COMMISSION" or "PAYOUT" => "/affiliate/commissions",
            "ACCOUNT" or "COMPANY" => "/profile",
            _ => null
        };
    }

    private static string ResolveInterviewRoute(Guid? interviewId, string? metadata)
    {
        var applicationId = TryReadGuid(metadata, "applicationId");
        return applicationId.HasValue && interviewId.HasValue
            ? $"/candidate/applications/{applicationId.Value}/interviews/{interviewId.Value}"
            : "/candidate/applications";
    }

    private static string ResolveOfferRoute(string? metadata)
    {
        var applicationId = TryReadGuid(metadata, "applicationId");
        return applicationId.HasValue
            ? $"/candidate/applications/{applicationId.Value}"
            : "/candidate/applications";
    }

    private static Guid? TryReadGuid(string? metadata, string propertyName)
    {
        var value = TryReadString(metadata, propertyName);
        return Guid.TryParse(value, out var guid) ? guid : null;
    }

    private static string? TryReadString(string? metadata, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(metadata)) return null;

        try
        {
            using var document = JsonDocument.Parse(metadata);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return null;

            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase)
                    && property.Value.ValueKind == JsonValueKind.String)
                {
                    return property.Value.GetString();
                }
            }
        }
        catch (JsonException)
        {
            // Metadata predates structured MF-04 payloads or is malformed. Use the safe list route.
        }

        return null;
    }
}

public sealed record NotificationPageDto(
    IReadOnlyList<NotificationDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public sealed record UnreadNotificationCountDto(int UnreadCount);

public sealed record MarkNotificationReadResponse(
    bool Success,
    string Message,
    int UpdatedCount);
