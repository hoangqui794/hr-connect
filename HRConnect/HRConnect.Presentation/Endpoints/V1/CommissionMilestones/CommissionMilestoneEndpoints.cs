using System.Security.Claims;
using HRConnect.Application.Features.CommissionMilestones.Queries.GetCommissionMilestones;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.CommissionMilestones;

public static class CommissionMilestoneEndpoints
{
    public static IEndpointRouteBuilder MapCommissionMilestoneEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/commission-milestones")
            .WithTags("Admin Commission Rules")
            .RequireAuthorization();

        group.MapGet("", async (
            [FromQuery] bool? isActive,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            return Results.Ok(await sender.Send(new GetCommissionMilestonesQuery(isActive ?? true), cancellationToken));
        })
        .WithName("GetCommissionMilestones")
        .WithSummary("Lấy danh sách mốc hoa hồng")
        .WithDescription("Admin lấy các mốc để tạo quy tắc hoa hồng. Mặc định chỉ trả mốc đang hoạt động.")
        .Produces<GetCommissionMilestonesResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        return app;
    }

    // commission.manage is the permission seeded for managing commission rules (DatabaseSeeder).
    private static bool HasAdminAccess(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "commission.manage") ||
        user.HasClaim("permission", "system_config.manage");
}
