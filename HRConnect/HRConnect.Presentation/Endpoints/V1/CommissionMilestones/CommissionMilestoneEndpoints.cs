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
                    message = "Ban khong co quyen thuc hien thao tac nay. Yeu cau quyen quan tri vien."
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

    private static bool HasAdminAccess(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "service_type.manage") ||
        user.HasClaim("permission", "system_config.manage");
}
