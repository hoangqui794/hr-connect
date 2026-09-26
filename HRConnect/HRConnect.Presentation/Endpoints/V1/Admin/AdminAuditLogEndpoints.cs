using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Admin.AuditLogs;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using HRConnect.Presentation.Authorization;

namespace HRConnect.Presentation.Endpoints.V1.Admin;

public static class AdminAuditLogEndpoints
{
    private const string AuditViewPermission = "audit.view";

    public static IEndpointRouteBuilder MapAdminAuditLogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/audit-logs")
            .WithTags("Admin Audit Logs")
            .RequireAuthorization();

        group.MapGet("/", async (
            [FromQuery] Guid? actorUserId,
            [FromQuery] string? action,
            [FromQuery] string? entityType,
            [FromQuery] Guid? entityId,
            [FromQuery] Guid? correlationId,
            [FromQuery] DateTime? fromUtc,
            [FromQuery] DateTime? toUtc,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            if (!PermissionAuthorization.HasPermission(user, AuditViewPermission))
                return PermissionAuthorization.Forbidden(AuditViewPermission);

            try
            {
                var result = await sender.Send(new GetAuditLogsQuery(
                    actorUserId,
                    action,
                    entityType,
                    entityId,
                    correlationId,
                    fromUtc,
                    toUtc,
                    page,
                    pageSize), cancellationToken);
                return Results.Ok(result);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetAuditLogs")
        .WithSummary("Xem danh sách audit log")
        .WithDescription("Yêu cầu quyền audit.view. Hỗ trợ lọc theo người thực hiện, action, entity, correlation ID, khoảng thời gian và phân trang; dữ liệu mới nhất được trả về trước.")
        .Produces<GetAuditLogsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        return app;
    }

}
