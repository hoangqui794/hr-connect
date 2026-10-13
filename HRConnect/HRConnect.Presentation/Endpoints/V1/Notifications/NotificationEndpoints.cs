using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Notifications.Commands.MarkAllNotificationsRead;
using HRConnect.Application.Features.Notifications.Commands.MarkNotificationRead;
using HRConnect.Application.Features.Notifications.DTOs;
using HRConnect.Application.Features.Notifications.Queries.GetNotifications;
using HRConnect.Application.Features.Notifications.Queries.GetUnreadNotificationCount;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace HRConnect.Presentation.Endpoints.V1.Notifications;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/notifications")
                       .WithTags("Notifications")
                       .RequireAuthorization();

        // 1. GET /api/v1/notifications?page=1&pageSize=20&type=&isRead=
        group.MapGet("", async (
            ClaimsPrincipal user,
            [FromQuery] string? type,
            [FromQuery] bool? isRead,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromServices] ISender sender,
            CancellationToken ct) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();

            var result = await sender.Send(new GetNotificationsQuery(
                userId.Value,
                type,
                isRead,
                page is > 0 ? page.Value : 1,
                pageSize is > 0 ? pageSize.Value : 20), ct);

            return Results.Ok(result);
        })
        .WithName("GetNotifications")
        .WithSummary("Lấy danh sách thông báo của người dùng hiện tại")
        .WithDescription("Yêu cầu đăng nhập. Tự động lấy userId từ JWT token; người dùng chỉ xem được thông báo của chính mình. Danh sách phân trang tại database, sắp xếp mới nhất trước. Hỗ trợ lọc theo type và isRead.")
        .Produces<NotificationPageDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized);

        // 2. GET /api/v1/notifications/unread-count
        group.MapGet("/unread-count", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken ct) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();

            var result = await sender.Send(new GetUnreadNotificationCountQuery(userId.Value), ct);
            return Results.Ok(result);
        })
        .WithName("GetUnreadNotificationCount")
        .WithSummary("Lấy số lượng thông báo chưa đọc")
        .WithDescription("Yêu cầu đăng nhập. Trả về tổng số lượng thông báo chưa đọc của người dùng hiện tại.")
        .Produces<UnreadNotificationCountDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized);

        // 3. POST /api/v1/notifications/{notificationId:guid}/read
        group.MapPost("/{notificationId:guid}/read", async (
            Guid notificationId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken ct) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();

            try
            {
                var result = await sender.Send(new MarkNotificationReadCommand(notificationId, userId.Value), ct);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
        })
        .WithName("MarkNotificationRead")
        .WithSummary("Đánh dấu một thông báo là đã đọc")
        .WithDescription("Idempotent: chỉ người sở hữu thông báo mới có thể đánh dấu đã đọc.")
        .Produces<MarkNotificationReadResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound);

        // 4. POST /api/v1/notifications/read-all
        group.MapPost("/read-all", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken ct) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();

            var result = await sender.Send(new MarkAllNotificationsReadCommand(userId.Value), ct);
            return Results.Ok(result);
        })
        .WithName("MarkAllNotificationsRead")
        .WithSummary("Đánh dấu tất cả thông báo là đã đọc")
        .WithDescription("Idempotent: cập nhật toàn bộ thông báo chưa đọc của người dùng hiện tại sang trạng thái đã đọc.")
        .Produces<MarkNotificationReadResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized);

        return app;
    }

    private static Guid? GetUserIdFromClaims(ClaimsPrincipal user)
    {
        var claimValue = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? user.FindFirst("sub")?.Value;

        return Guid.TryParse(claimValue, out var userId) ? userId : null;
    }
}
