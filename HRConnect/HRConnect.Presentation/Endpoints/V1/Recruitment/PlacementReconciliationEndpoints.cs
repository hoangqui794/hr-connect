using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Placements.Commands.ReconcilePlacement;
using HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;
using HRConnect.Application.Features.Placements.Queries.GetPlacementReconciliations;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class PlacementReconciliationEndpoints
{
    private const string ReconcilePermission = "placement.reconcile";

    public static IEndpointRouteBuilder MapPlacementReconciliationEndpoints(this IEndpointRouteBuilder app)
    {
        var hr = app.MapGroup("/api/v1/internal-hr/placement-reconciliations")
            .WithTags("Placement Reconciliation")
            .RequireAuthorization();

        hr.MapGet("/", async (
            [FromQuery] string? status,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!CanReconcile(user)) return PermissionAuthorization.Forbidden(ReconcilePermission);
            try
            {
                return Results.Ok(await sender.Send(new GetPlacementReconciliationsQuery(status, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), cancellationToken));
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message, errorCode = ex.ErrorCode });
            }
        })
        .WithName("GetPlacementReconciliations")
        .WithSummary("Danh sách kết quả nhận việc cần Internal HR đối soát")
        .Produces<GetPlacementReconciliationsResponse>();

        hr.MapPost("/{applicationId:guid}", async (
            Guid applicationId,
            [FromBody] ReconcilePlacementRequest request,
            ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!CanReconcile(user)) return PermissionAuthorization.Forbidden(ReconcilePermission);
            var userId = GetUserId(user);
            if (userId == null) return Results.Unauthorized();
            try
            {
                return Results.Ok(await sender.Send(new ReconcilePlacementCommand(
                    applicationId,
                    request.Decision,
                    request.ContactChannel,
                    request.Note,
                    request.ConcurrencyToken,
                    userId.Value), cancellationToken));
            }
            catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
            catch (ConflictException ex) { return Results.Conflict(new { success = false, message = ex.Message, errorCode = ex.ErrorCode }); }
            catch (BadRequestException ex) { return Results.BadRequest(new { success = false, message = ex.Message, errorCode = ex.ErrorCode }); }
        })
        .WithName("ReconcilePlacement")
        .WithSummary("Xác nhận hoặc báo không khớp kết quả nhận việc")
        .Produces<ReconcilePlacementResponse>();

        var admin = app.MapGroup("/api/v1/admin/placement-reconciliations")
            .WithTags("Placement Reconciliation")
            .RequireAuthorization();

        admin.MapGet("/", async (
            [FromQuery] string? status,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!user.IsInRole("PLATFORM_ADMIN")) return PermissionAuthorization.Forbidden("PLATFORM_ADMIN");
            try
            {
                return Results.Ok(await sender.Send(new GetPlacementReconciliationsQuery(status, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), cancellationToken));
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message, errorCode = ex.ErrorCode });
            }
        });

        admin.MapPost("/{applicationId:guid}/resolve", async (
            Guid applicationId,
            [FromBody] ResolveFlaggedReconciliationRequest request,
            ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!user.IsInRole("PLATFORM_ADMIN")) return PermissionAuthorization.Forbidden("PLATFORM_ADMIN");
            var userId = GetUserId(user);
            if (userId == null) return Results.Unauthorized();
            try
            {
                return Results.Ok(await sender.Send(new ResolveFlaggedReconciliationCommand(
                    applicationId,
                    request.Note,
                    request.ConcurrencyToken,
                    userId.Value), cancellationToken));
            }
            catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
            catch (ConflictException ex) { return Results.Conflict(new { success = false, message = ex.Message, errorCode = ex.ErrorCode }); }
            catch (BadRequestException ex) { return Results.BadRequest(new { success = false, message = ex.Message, errorCode = ex.ErrorCode }); }
        })
        .WithName("ResolveFlaggedPlacementReconciliation")
        .WithSummary("Platform Admin đóng hồ sơ đối soát sau khi xử lý ngoại lệ")
        .Produces<ResolveFlaggedReconciliationResponse>();

        return app;
    }

    private static bool CanReconcile(ClaimsPrincipal user) =>
        user.IsInRole("INTERNAL_HR") && PermissionAuthorization.HasPermission(user, ReconcilePermission);

    private static Guid? GetUserId(ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(value, out var id) ? id : null;
    }
}

public sealed record ReconcilePlacementRequest(string Decision, string ContactChannel, string? Note, Guid? ConcurrencyToken);
public sealed record ResolveFlaggedReconciliationRequest(string Note, Guid? ConcurrencyToken);
