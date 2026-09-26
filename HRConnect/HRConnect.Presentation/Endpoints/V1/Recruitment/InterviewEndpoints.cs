using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Queries.GetInterviews;
using HRConnect.Application.Features.Interviews.Queries.GetInterviewDetail;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Interviews.Commands.UpdateInterview;
using HRConnect.Application.Features.Interviews.Commands.RescheduleInterview;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class InterviewEndpoints
{
    private const string ViewCompanyPermission = "interview.view_company";
    private const string ViewOwnPermission = "interview.view_own";
    private const string ManagePermission = "interview.manage";
    private const string CreatePermission = "interview.create";
    private const string UpdatePermission = "interview.update";

    public static IEndpointRouteBuilder MapInterviewEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/interviews")
                       .WithTags("Interviews")
                       .RequireAuthorization();

        // I01: GET /api/v1/interviews
        group.MapGet("/", async (
            [FromQuery] Guid? jobId,
            [FromQuery] Guid? applicationId,
            [FromQuery] Guid? interviewerId,
            [FromQuery] string? status,
            [FromQuery] string? result,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManagePermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ManagePermission);
            }

            try
            {
                var query = new GetInterviewsQuery(
                    UserId: userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    IsCandidate: isCandidate && !isClient && !isInternal && !isAdmin,
                    JobId: jobId,
                    ApplicationId: applicationId,
                    InterviewerId: interviewerId,
                    Status: status,
                    Result: result,
                    FromDate: fromDate,
                    ToDate: toDate,
                    Page: page,
                    PageSize: pageSize
                );

                var response = await sender.Send(query, cancellationToken);
                return Results.Ok(response);
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetInterviews")
        .WithSummary("Lấy danh sách lịch phỏng vấn")
        .WithDescription("Hỗ trợ lọc theo jobId, applicationId, interviewerId, status, result, khoảng thời gian và phân trang. Tự động áp dụng phân quyền theo Client Company (interview.view_company), Internal HR (interview.manage), hoặc Candidate (interview.view_own).")
        .Produces<GetInterviewsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        // I02: GET /api/v1/interviews/{interviewId:guid}
        group.MapGet("/{interviewId:guid}", async (
            Guid interviewId,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManagePermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ManagePermission);
            }

            try
            {
                var query = new GetInterviewDetailQuery(
                    interviewId,
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    IsCandidate: isCandidate && !isClient && !isInternal && !isAdmin
                );

                var response = await sender.Send(query, cancellationToken);
                return Results.Ok(response);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetInterviewDetail")
        .WithSummary("Lấy chi tiết một lịch phỏng vấn")
        .WithDescription("Dành cho Client Company (interview.view_company), Internal HR / Admin (interview.manage), hoặc Candidate (interview.view_own). Trả về chi tiết ứng viên, công việc, hình thức, link/địa điểm, danh sách người tham gia, lịch sử dời/hủy lịch và kết quả đánh giá.")
        .Produces<GetInterviewDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // I03: POST /api/v1/interviews
        group.MapPost("/", async (
            [FromBody] ScheduleInterviewRequest request,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var canCreate = PermissionAuthorization.HasPermission(user, CreatePermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManagePermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!canCreate && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(CreatePermission);
            }

            try
            {
                var command = new ScheduleInterviewCommand(
                    ApplicationId: request.ApplicationId,
                    ScheduledAt: request.ScheduledAt,
                    DurationMinutes: request.DurationMinutes,
                    InterviewRound: request.InterviewRound,
                    InterviewType: request.InterviewType,
                    Location: request.Location,
                    MeetingLink: request.MeetingLink,
                    Participants: request.Participants,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: canCreate && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin
                );

                var response = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/v1/interviews/{response.Data.InterviewId}", response);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("ScheduleInterview")
        .WithSummary("Lập lịch phỏng vấn mới")
        .WithDescription("Dành cho Client Company (interview.create) hoặc Internal HR / Admin (interview.manage). Tạo lịch phỏng vấn, thêm danh sách người phỏng vấn và chuyển trạng thái hồ sơ sang INTERVIEWING.")
        .Produces<ScheduleInterviewResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // I04: PUT /api/v1/interviews/{interviewId:guid}
        group.MapPut("/{interviewId:guid}", async (
            Guid interviewId,
            [FromBody] UpdateInterviewRequest request,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var canUpdate = PermissionAuthorization.HasPermission(user, UpdatePermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManagePermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!canUpdate && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(UpdatePermission);
            }

            try
            {
                var command = new UpdateInterviewCommand(
                    InterviewId: interviewId,
                    DurationMinutes: request.DurationMinutes,
                    InterviewType: request.InterviewType,
                    Location: request.Location,
                    MeetingLink: request.MeetingLink,
                    Participants: request.Participants,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: canUpdate && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin
                );

                var response = await sender.Send(command, cancellationToken);
                return Results.Ok(response);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("UpdateInterview")
        .WithSummary("Cập nhật thông tin lịch phỏng vấn")
        .WithDescription("Dành cho Client Company (interview.update) hoặc Internal HR / Admin (interview.manage). Chỉ cập nhật khi lịch ở trạng thái SCHEDULED/RESCHEDULED. Hỗ trợ kiểm tra ConcurrencyToken chống ghi đè dữ liệu.")
        .Produces<UpdateInterviewResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // I05: PUT /api/v1/interviews/{interviewId:guid}/reschedule
        group.MapPut("/{interviewId:guid}/reschedule", async (
            Guid interviewId,
            [FromBody] RescheduleInterviewRequest request,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var canUpdate = PermissionAuthorization.HasPermission(user, UpdatePermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManagePermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!canUpdate && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(UpdatePermission);
            }

            try
            {
                var command = new RescheduleInterviewCommand(
                    InterviewId: interviewId,
                    NewScheduledAt: request.NewScheduledAt,
                    Reason: request.Reason,
                    DurationMinutes: request.DurationMinutes,
                    Location: request.Location,
                    MeetingLink: request.MeetingLink,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: canUpdate && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin
                );

                var response = await sender.Send(command, cancellationToken);
                return Results.Ok(response);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("RescheduleInterview")
        .WithSummary("Dời lịch phỏng vấn sang thời gian mới")
        .WithDescription("Dành cho Client Company (interview.update) hoặc Internal HR / Admin (interview.manage). Bắt buộc nhập thời gian mới và lý do dời lịch. Tự động ghi lại lịch sử trạng thái RESCHEDULED.")
        .Produces<RescheduleInterviewResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        return app;
    }

    private static Guid? GetUserIdFromClaims(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? user.FindFirst("sub")?.Value;

        if (Guid.TryParse(idClaim, out var userId))
        {
            return userId;
        }

        return null;
    }
}

public record ScheduleInterviewRequest(
    Guid ApplicationId,
    DateTime ScheduledAt,
    int? DurationMinutes,
    int? InterviewRound,
    string? InterviewType,
    string? Location,
    string? MeetingLink,
    List<ScheduleInterviewParticipantDto>? Participants
);

public record UpdateInterviewRequest(
    int? DurationMinutes,
    string? InterviewType,
    string? Location,
    string? MeetingLink,
    List<ScheduleInterviewParticipantDto>? Participants,
    Guid? ConcurrencyToken
);

public record RescheduleInterviewRequest(
    DateTime NewScheduledAt,
    string Reason,
    int? DurationMinutes,
    string? Location,
    string? MeetingLink,
    Guid? ConcurrencyToken
);
