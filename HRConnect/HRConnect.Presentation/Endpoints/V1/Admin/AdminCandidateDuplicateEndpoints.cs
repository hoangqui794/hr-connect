using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.CandidateDuplicates.Queries;
using HRConnect.Application.Features.CandidateDuplicates.PreviewMerge;
using HRConnect.Application.Features.CandidateDuplicates.Resolve;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Admin;

public static class AdminCandidateDuplicateEndpoints
{
    private const string ViewPermission = "candidate_duplicate.view";
    private const string ResolvePermission = "candidate_duplicate.resolve";

    public static IEndpointRouteBuilder MapAdminCandidateDuplicateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/candidate-duplicate-cases")
            .WithTags("Admin Candidate Duplicate Cases")
            .RequireAuthorization();

        group.MapGet("/", async (
            [FromQuery] string? status,
            [FromQuery] string? riskLevel,
            [FromQuery] Guid? jobId,
            [FromQuery] Guid? companyId,
            [FromQuery] DateTime? createdFrom,
            [FromQuery] DateTime? createdTo,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromServices] ISender sender = null!,
            [FromServices] IValidator<GetCandidateDuplicateCasesQuery> validator = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ViewPermission))
                return PermissionAuthorization.Forbidden(ViewPermission);

            var query = new GetCandidateDuplicateCasesQuery(
                status, riskLevel, jobId, companyId, createdFrom, createdTo, search, page, pageSize);
            var validation = await validator.ValidateAsync(query, cancellationToken);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            return Results.Ok(await sender.Send(query, cancellationToken));
        })
        .WithName("GetCandidateDuplicateCases")
        .WithSummary("Admin xem hàng đợi hồ sơ Candidate nghi trùng")
        .WithDescription("Yêu cầu quyền candidate_duplicate.view. Hỗ trợ lọc trạng thái, mức rủi ro, công việc, doanh nghiệp, ngày tạo và tìm kiếm. Email, số điện thoại luôn được che một phần.")
        .Produces<CandidateDuplicateCaseListResponse>(StatusCodes.Status200OK)
        .ProducesValidationProblem(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/{caseId:guid}", async (
            Guid caseId,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ViewPermission))
                return PermissionAuthorization.Forbidden(ViewPermission);

            try
            {
                return Results.Ok(await sender.Send(
                    new GetCandidateDuplicateCaseDetailQuery(caseId),
                    cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetCandidateDuplicateCaseDetail")
        .WithSummary("Admin xem bằng chứng và tác động của hồ sơ Candidate nghi trùng")
        .WithDescription("Yêu cầu quyền candidate_duplicate.view. Trả tín hiệu đã giảm PII, lịch sử consent/submission, Application, Attribution và trạng thái commission liên quan; không trả raw CV text hay contact đầy đủ.")
        .Produces<CandidateDuplicateCaseDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/{caseId:guid}/preview-merge", async (
            Guid caseId,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ResolvePermission))
                return PermissionAuthorization.Forbidden(ResolvePermission);

            try
            {
                return Results.Ok(await sender.Send(
                    new PreviewCandidateDuplicateMergeQuery(caseId),
                    cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new
                {
                    success = false,
                    message = ex.Message,
                    errorCode = ex.ErrorCode
                });
            }
        })
        .WithName("PreviewCandidateDuplicateMerge")
        .WithSummary("Xem trước tác động trước khi hợp nhất Candidate")
        .WithDescription("Yêu cầu quyền candidate_duplicate.resolve. API chỉ đọc: đề xuất hồ sơ chính, liệt kê collision theo Job và chặn hợp nhất nếu phát hiện payout đã COMPLETED.")
        .Produces<PreviewCandidateDuplicateMergeResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        group.MapPost("/{caseId:guid}/resolve", async (
            Guid caseId,
            [FromBody] ResolveCandidateDuplicateCaseRequest body,
            [FromServices] ISender sender,
            [FromServices] IValidator<ResolveCandidateDuplicateCaseCommand> validator,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ResolvePermission))
                return PermissionAuthorization.Forbidden(ResolvePermission);
            var adminUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(adminUserId, out var parsedAdminUserId))
                return Results.Unauthorized();

            var command = new ResolveCandidateDuplicateCaseCommand(
                caseId,
                parsedAdminUserId,
                body.Decision,
                body.Reason,
                body.ConcurrencyToken,
                body.IdempotencyKey);
            var validation = await validator.ValidateAsync(command, cancellationToken);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            try
            {
                return Results.Ok(await sender.Send(command, cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new
                {
                    success = false,
                    message = ex.Message,
                    errorCode = ex.ErrorCode
                });
            }
        })
        .WithName("ResolveCandidateDuplicateCase")
        .WithSummary("Admin xử lý hồ sơ Candidate nghi trùng")
        .WithDescription("Yêu cầu quyền candidate_duplicate.resolve. Hỗ trợ MERGE, DISMISS và NEED_MORE_EVIDENCE; bắt buộc concurrencyToken, idempotencyKey và lý do. MERGE bị chặn khi có payout COMPLETED.")
        .Produces<ResolveCandidateDuplicateCaseResponse>(StatusCodes.Status200OK)
        .ProducesValidationProblem(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        return app;
    }
}

public sealed record ResolveCandidateDuplicateCaseRequest(
    string Decision,
    string Reason,
    Guid ConcurrencyToken,
    string IdempotencyKey);
