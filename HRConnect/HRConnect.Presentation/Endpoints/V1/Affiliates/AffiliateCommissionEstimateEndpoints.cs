using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Affiliates.Queries.GetJobCommissionEstimate;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Affiliates;

/// <summary>N12: estimated commission shown on the affiliate job detail.</summary>
public static class AffiliateCommissionEstimateEndpoints
{
    private const string Permission = "commission.view_own";

    public static IEndpointRouteBuilder MapAffiliateCommissionEstimateEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/affiliates/jobs/{jobId:guid}/commission-estimate",
                async (Guid jobId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                {
                    if (!PermissionAuthorization.HasPermission(user, Permission)) return PermissionAuthorization.Forbidden(Permission);
                    var roles = user.FindAll(ClaimTypes.Role).Select(c => c.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
                    try
                    {
                        return Results.Ok(new { success = true, data = await sender.Send(new GetJobCommissionEstimateQuery(jobId, roles), ct) });
                    }
                    catch (NotFoundException ex)
                    {
                        return Results.NotFound(new { success = false, message = ex.Message });
                    }
                })
            .RequireAuthorization()
            .WithTags("Affiliate")
            .WithName("GetJobCommissionEstimate")
            .WithSummary("Hoa hồng ước tính của một job (Affiliate)")
            .WithDescription("HEADHUNT_COD: tỷ lệ theo quy tắc hoa hồng đang áp dụng × phí (hệ số × lương gross tháng), khoảng ước tính theo lương đăng tin, kèm số ngày bảo hành. CV_SOURCING: số tiền mỗi CV được chấp nhận. Dịch vụ khác: hasCommission=false. Chỉ job ACTIVE mà vai trò được xem. Quyền commission.view_own.");

        return app;
    }
}
