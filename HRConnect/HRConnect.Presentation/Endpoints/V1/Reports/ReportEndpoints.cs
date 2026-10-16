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
            .WithTags("Admin Reports")
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
        .WithSummary("Xem báo cáo tổng quan nền tảng")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền report.view. Báo cáo tổng quan số lượng việc làm theo trạng thái hiện tại, phân loại dịch vụ phát sinh trong kỳ, hồ sơ ứng tuyển, tiếp nhận việc làm, doanh nghiệp và affiliate.")
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
        .WithSummary("Xem báo cáo doanh thu theo dịch vụ")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền report.view. Báo cáo doanh thu phát sinh (billed) và thực thu (collected) theo từng gói dịch vụ (HEADHUNT_COD, CV_APPLICATION, CV_SOURCING), chuỗi thời gian gom theo tháng/quý/năm (theo giờ Việt Nam) và hoa hồng phát sinh/đã chi trả.")
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
        .WithSummary("Xem báo cáo xếp hạng Affiliate")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền report.view. Xếp hạng Affiliate theo số placement (mặc định), tỷ lệ chuyển đổi (kèm điều kiện lọc tối thiểu số lượt nộp) hoặc hoa hồng kiếm được.")
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
        .WithSummary("Xem báo cáo xếp hạng Doanh nghiệp")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền report.view. Xếp hạng Doanh nghiệp tuyển dụng theo số tuyển dụng thành công (mặc định), doanh thu đóng góp hoặc số việc làm đang tuyển.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        return app;
    }
}
