using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Reports.Commands.RecalculateAffiliatePerformance;
using HRConnect.Application.Features.Reports.Queries.GetAdminAffiliatePerformance;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace HRConnect.Presentation.Endpoints.V1.Reports;

public static class AdminAffiliatePerformanceEndpoints
{
    private const string ReportViewPermission = "report.view";

    public static IEndpointRouteBuilder MapAdminAffiliatePerformanceEndpoints(this IEndpointRouteBuilder app)
    {
        // 1. GET /api/v1/admin/affiliates/{affiliateId}/performance
        app.MapGet("/api/v1/admin/affiliates/{affiliateId:guid}/performance", async (
            [FromRoute] Guid affiliateId,
            [FromQuery] string? period,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ReportViewPermission))
                return PermissionAuthorization.Forbidden(ReportViewPermission);

            try
            {
                var result = await sender.Send(new GetAdminAffiliatePerformanceQuery(affiliateId, period), ct);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetAdminAffiliatePerformance")
        .WithTags("Admin Reports")
        .WithSummary("Admin xem chi tiết hiệu suất của từng đối tác tuyển dụng")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền report.view. Xem chi tiết các chỉ số hiệu suất tuyển dụng theo kỳ (MONTH, QUARTER, YEAR) và lịch sử của một Affiliate.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // 2. POST /api/v1/admin/affiliate-performance/recalculate
        app.MapPost("/api/v1/admin/affiliate-performance/recalculate", async (
            [FromBody] RecalculateAffiliatePerformanceCommand command,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ReportViewPermission))
                return PermissionAuthorization.Forbidden(ReportViewPermission);

            try
            {
                var result = await sender.Send(command, ct);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("RecalculateAffiliatePerformance")
        .WithTags("Admin Reports")
        .WithSummary("Tính toán lại chỉ số hiệu suất Affiliate theo khoảng thời gian")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền report.view. Tính lại số liệu hiệu suất và xếp hạng chất lượng cho một Affiliate hoặc toàn bộ Affiliate đang hoạt động trong khoảng thời gian tùy chọn.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        return app;
    }
}
