using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Reports.Queries.GetReportOverview;
using HRConnect.Application.Features.Reports.Queries.GetReportRevenue;
using HRConnect.Application.Features.Reports.Queries.GetReportTopAffiliates;
using HRConnect.Application.Features.Reports.Queries.GetReportTopCompanies;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace HRConnect.Presentation.Endpoints.V1.Reports;

public static class ReportEndpoints
{
    private const string ReportViewPermission = "report.view";

    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reports")
            .WithTags("Reports")
            .RequireAuthorization();

        group.MapGet("/overview", async (
            [FromQuery] DateOnly? from,
            [FromQuery] DateOnly? to,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ReportViewPermission))
                return PermissionAuthorization.Forbidden(ReportViewPermission);

            try
            {
                var result = await sender.Send(new GetReportOverviewQuery(from, to), ct);
                return Results.Ok(new { success = true, data = result });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetReportOverview")
        .WithSummary("Dashboard tổng quan hệ thống")
        .WithDescription("Báo cáo tổng quan số lượng việc làm theo trạng thái, loại dịch vụ, ứng tuyển, tiếp nhận và doanh nghiệp/affiliate. Yêu cầu quyền report.view.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/revenue", async (
            [FromQuery] DateOnly? from,
            [FromQuery] DateOnly? to,
            [FromQuery] string? groupBy,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ReportViewPermission))
                return PermissionAuthorization.Forbidden(ReportViewPermission);

            try
            {
                var result = await sender.Send(new GetReportRevenueQuery(from, to, groupBy), ct);
                return Results.Ok(new { success = true, data = result });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetReportRevenue")
        .WithSummary("Báo cáo doanh thu theo dịch vụ")
        .WithDescription("Báo cáo doanh thu phát sinh và thực thu theo từng gói dịch vụ, chuỗi thời gian gom theo tháng/quý/năm và hoa hồng phát sinh/đã chi trả. Yêu cầu quyền report.view.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/top-affiliates", async (
            [FromQuery] DateOnly? from,
            [FromQuery] DateOnly? to,
            [FromQuery] string? sortBy,
            [FromQuery] int limit = 10,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken ct = default) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ReportViewPermission))
                return PermissionAuthorization.Forbidden(ReportViewPermission);

            try
            {
                var result = await sender.Send(new GetReportTopAffiliatesQuery(from, to, sortBy, limit), ct);
                return Results.Ok(new { success = true, data = result });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetReportTopAffiliates")
        .WithSummary("Báo cáo xếp hạng Affiliate hàng đầu")
        .WithDescription("Danh sách xếp hạng Affiliate theo số placement, tỷ lệ chuyển đổi hoặc hoa hồng kiếm được. Yêu cầu quyền report.view.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/top-companies", async (
            [FromQuery] DateOnly? from,
            [FromQuery] DateOnly? to,
            [FromQuery] string? sortBy,
            [FromQuery] int limit = 10,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken ct = default) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ReportViewPermission))
                return PermissionAuthorization.Forbidden(ReportViewPermission);

            try
            {
                var result = await sender.Send(new GetReportTopCompaniesQuery(from, to, sortBy, limit), ct);
                return Results.Ok(new { success = true, data = result });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetReportTopCompanies")
        .WithSummary("Báo cáo xếp hạng Doanh nghiệp hàng đầu")
        .WithDescription("Danh sách doanh nghiệp hàng đầu theo số lượng tuyển dụng thành công, doanh thu đóng góp hoặc việc làm đang mở. Yêu cầu quyền report.view.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        return app;
    }
}
