using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Admin.Dashboard;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Admin;

public static class AdminDashboardEndpoints
{
    private const string ReportViewPermission = "report.view";

    public static IEndpointRouteBuilder MapAdminDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/dashboard")
            .WithTags("Admin Dashboard")
            .RequireAuthorization();

        group.MapGet("/metrics", async (
            [FromQuery] string? range,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ReportViewPermission))
                return PermissionAuthorization.Forbidden(ReportViewPermission);

            try
            {
                var result = await sender.Send(new GetAdminDashboardMetricsQuery(range), ct);
                return Results.Ok(new { success = true, data = result });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetAdminDashboardMetrics")
        .WithSummary("Số liệu Tổng quan Admin (KPI + dòng tiền + hoạt động theo ngày)")
        .WithDescription("Cần quyền report.view. range = 7d | 30d | 90d (giá trị khác dùng 30d), tính cả hôm nay theo giờ Việt Nam. Chuỗi cashflowSeries / activitySeries đủ một điểm mỗi ngày (ngày trống = 0). Tiền tính VND như báo cáo doanh thu; serviceFeesPaidAmount không gồm tiền hoàn cho Client (CREDIT, REPLACEMENT_REFUND), khoản đó nằm ở refundsPaidAmount.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        return app;
    }
}
