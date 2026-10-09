using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Queries.GetInterviews;
using HRConnect.Application.Features.Interviews.Queries.GetInterviewDetail;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Interviews.Commands.UpdateInterview;
using HRConnect.Application.Features.Interviews.Commands.RescheduleInterview;
using HRConnect.Application.Features.Interviews.Commands.CancelInterview;
using HRConnect.Application.Features.Interviews.Commands.RecordInterviewResult;
using HRConnect.Application.Features.Interviews.Commands.RecordInterviewNoShow;
using HRConnect.Application.Features.Interviews.Queries.GetInterviewHistory;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class InterviewEndpoints
{
    private const string ViewCompanyPermission = "interview.view_company";
    private const string ViewOwnPermission = "interview.view_own";
    private const string InternalViewPermission = "application.view";
    private const string CreatePermission = "interview.create";
    private const string UpdatePermission = "interview.update";
    private const string RecordResultPermission = "interview.record_result";

    public static IEndpointRouteBuilder MapInterviewEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/interviews")
                       .WithTags("Interviews")
                       .RequireAuthorization();
        var schedulingGroup = app.MapGroup("/api/v1/recruitment/applications")
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
            var isInternal = PermissionAuthorization.HasPermission(user, InternalViewPermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(InternalViewPermission);
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
        .WithDescription("Hỗ trợ lọc theo jobId, applicationId, interviewerId, status, result, khoảng thời gian và phân trang. Tự động áp dụng phân quyền theo Client Company (interview.view_company), Internal HR (application.view), hoặc Candidate (interview.view_own).")
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
            var isInternal = PermissionAuthorization.HasPermission(user, InternalViewPermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(InternalViewPermission);
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
        .WithDescription("Dành cho Client Company (interview.view_company), Internal HR / Admin (application.view), hoặc Candidate (interview.view_own). Client/Internal HR/Admin nhận dữ liệu nội bộ theo quyền; Candidate chỉ nhận lịch, hình thức, link/địa điểm và trạng thái của chính mình, không nhận người tham gia nội bộ, feedback hay kết quả đánh giá.")
        .Produces<GetInterviewDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // I03: POST /api/v1/recruitment/applications/{applicationId}/interviews
        schedulingGroup.MapPost("/{applicationId:guid}/interviews", async (
            Guid applicationId,
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

            if (!canCreate)
            {
                return PermissionAuthorization.Forbidden(CreatePermission);
            }

            try
            {
                var command = new ScheduleInterviewCommand(
                    ApplicationId: applicationId,
                    ScheduledAt: request.ScheduledAt,
                    DurationMinutes: request.DurationMinutes,
                    InterviewRound: request.InterviewRound,
                    InterviewType: request.InterviewType,
                    Location: request.Location,
                    MeetingLink: request.MeetingLink,
                    Participants: request.Participants,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false,
                    ApplicationConcurrencyToken: request.ApplicationConcurrencyToken
                );

                var response = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/v1/interviews/{response.Data.InterviewId}", response);
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
        .WithName("ScheduleInterview")
        .WithSummary("Lập lịch phỏng vấn mới")
        .WithDescription("Chỉ Client Company sở hữu Job với quyền interview.create được lập lịch. Lập lịch vòng đầu khi hồ sơ SHORTLISTED; các vòng tiếp theo dùng hồ sơ INTERVIEW. Lập lịch đầu tiên chuyển hồ sơ sang INTERVIEW.")
        .Produces<ScheduleInterviewResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

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

            if (!canUpdate)
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
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền interview.update được cập nhật lịch ở trạng thái SCHEDULED. Hỗ trợ kiểm tra ConcurrencyToken chống ghi đè dữ liệu.")
        .Produces<UpdateInterviewResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // I05: POST /api/v1/interviews/{interviewId:guid}/reschedule
        group.MapPost("/{interviewId:guid}/reschedule", async (
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

            if (!canUpdate)
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
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền interview.update được dời lịch. Bắt buộc nhập thời gian mới và lý do dời lịch; history lưu giờ cũ và giờ mới.")
        .Produces<RescheduleInterviewResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // I06: POST /api/v1/interviews/{interviewId:guid}/cancel
        group.MapPost("/{interviewId:guid}/cancel", async (
            Guid interviewId,
            [FromBody] CancelInterviewRequest request,
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

            if (!canUpdate)
            {
                return PermissionAuthorization.Forbidden(UpdatePermission);
            }

            try
            {
                var command = new CancelInterviewCommand(
                    InterviewId: interviewId,
                    Reason: request.Reason,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithName("CancelInterview")
        .WithSummary("Hủy lịch phỏng vấn")
        .WithDescription("Chỉ Client Company sở hữu Job với quyền interview.update được hủy lịch. Bắt buộc nhập lý do hủy; hệ thống chuyển trạng thái sang CANCELLED và ghi lịch sử.")
        .Produces<CancelInterviewResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // I07: POST /api/v1/interviews/{interviewId:guid}/no-show
        group.MapPost("/{interviewId:guid}/no-show", async (
            Guid interviewId,
            [FromBody] RecordInterviewNoShowRequest request,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var canRecord = PermissionAuthorization.HasPermission(user, RecordResultPermission);
            if (!canRecord)
            {
                return PermissionAuthorization.Forbidden(RecordResultPermission);
            }

            try
            {
                var response = await sender.Send(new RecordInterviewNoShowCommand(
                    interviewId,
                    request.Reason,
                    request.ConcurrencyToken,
                    userId.Value,
                    true,
                    false), cancellationToken);
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
        .WithName("RecordInterviewNoShow")
        .WithSummary("Ghi nhận ứng viên vắng mặt phỏng vấn")
        .WithDescription("Chỉ Client Company sở hữu Job với quyền interview.record_result được ghi nhận ứng viên vắng mặt.")
        .Produces<RecordInterviewNoShowResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // I08: POST /api/v1/interviews/{interviewId:guid}/result
        group.MapPost("/{interviewId:guid}/result", async (
            Guid interviewId,
            [FromBody] RecordInterviewResultRequest request,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var canRecord = PermissionAuthorization.HasPermission(user, RecordResultPermission);

            if (!canRecord)
            {
                return PermissionAuthorization.Forbidden(RecordResultPermission);
            }

            try
            {
                var command = new RecordInterviewResultCommand(
                    InterviewId: interviewId,
                    Result: request.Result,
                    Feedback: request.Feedback,
                    IsFinalRound: request.IsFinalRound,
                    NextAction: request.NextAction,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithName("RecordInterviewResult")
        .WithSummary("Ghi nhận kết quả đánh giá phỏng vấn")
        .WithDescription("Chỉ Client Company sở hữu Job với quyền interview.record_result được ghi kết quả PASS, FAIL hoặc BACKUP. Kết quả cuối chuyển hồ sơ lần lượt sang OFFER_PENDING, INTERVIEW_FAILED hoặc BACKUP.")
        .Produces<RecordInterviewResultResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // I09: GET /api/v1/interviews/{interviewId:guid}/history
        group.MapGet("/{interviewId:guid}/history", async (
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
            var isInternal = PermissionAuthorization.HasPermission(user, InternalViewPermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(InternalViewPermission);
            }

            try
            {
                var query = new GetInterviewHistoryQuery(
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
        .WithName("GetInterviewHistory")
        .WithSummary("Lấy lịch sử thay đổi trạng thái, dời, hủy lịch phỏng vấn")
        .WithDescription("Dành cho Client Company (interview.view_company), Candidate (interview.view_own) hoặc Internal HR / Admin (application.view). Candidate chỉ nhận mốc thời gian và trạng thái công khai; actor nội bộ và lý do dời/hủy được che.")
        .Produces<GetInterviewHistoryResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

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
    DateTime ScheduledAt,
    int? DurationMinutes,
    int? InterviewRound,
    string? InterviewType,
    string? Location,
    string? MeetingLink,
    List<ScheduleInterviewParticipantDto>? Participants,
    Guid? ApplicationConcurrencyToken = null
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

public record CancelInterviewRequest(
    string Reason,
    Guid? ConcurrencyToken
);

public record RecordInterviewResultRequest(
    string Result,
    string? Feedback,
    bool IsFinalRound = false,
    string? NextAction = null,
    Guid? ConcurrencyToken = null
);

public record RecordInterviewNoShowRequest(string Reason, Guid? ConcurrencyToken = null);
