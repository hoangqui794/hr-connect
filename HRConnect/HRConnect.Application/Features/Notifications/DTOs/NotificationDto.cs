using System;
using System.Collections.Generic;
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
        ResolveRouteHint(notification.RelatedEntityType, notification.RelatedEntityId),
        notification.IsRead,
        notification.ReadAt,
        notification.CreatedAt,
        notification.Metadata);

    private static string? ResolveRouteHint(string? entityType, Guid? entityId)
    {
        if (string.IsNullOrWhiteSpace(entityType)) return null;

        return entityType.Trim().ToUpperInvariant() switch
        {
            "JOB" => entityId.HasValue ? $"/jobs/{entityId.Value}" : "/jobs",
            "APPLICATION" or "APPLICATION_STATUS" or "CANDIDATE_APPLICATION" => "/candidate/applications",
            "SUBMISSION" or "SUBMISSION_CONSENT_RESULT" => "/affiliate/submissions",
            "INTERVIEW" => "/interviews",
            "OFFER" => "/offers",
            "COMMISSION" or "PAYOUT" => "/affiliate/commissions",
            "ACCOUNT" or "COMPANY" => "/profile",
            _ => null
        };
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
