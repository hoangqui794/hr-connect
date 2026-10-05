using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Offers.Commands.CreateOfferDraft;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmPlannedStartDate;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;
using HRConnect.Application.Features.Recruitment.Commands.DecideBackupApplication;
using HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;
using HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;
using HRConnect.Application.Features.Recruitment.Commands.WithdrawApplication;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationTimeline;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class RecruitmentEndpoints
{
    private const string ViewCompanyPermission = "application.view_company";
    private const string ViewAllPermission = "application.view";
    private const string DecideBackupPermission = "application.decide_backup";
    private const string CreateOfferPermission = "offer.create";
    private const string ManageOfferPermission = "offer.manage";
    private const string PlacementConfirmPermission = "placement.confirm";
    private const string MarkNotStartedPermission = "application.mark_not_started";
    private const string WithdrawOwnPermission = "application.withdraw_own";
    private const string ReviewCompanyPermission = "candidate.review_company";

    public static IEndpointRouteBuilder MapRecruitmentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/recruitment")
                       .WithTags("Recruitment")
                       .RequireAuthorization();
        var companyJobGroup = app.MapGroup("/api/v1/jobs")
            .WithTags("Recruitment")
            .RequireAuthorization();

        companyJobGroup.MapPatch("/{jobId:guid}/applications/{applicationId:guid}/status", async (
            Guid jobId,
            Guid applicationId,
            [FromBody] UpdateApplicationScreeningStatusRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, ReviewCompanyPermission))
            {
                return PermissionAuthorization.Forbidden(ReviewCompanyPermission);
            }

            try
            {
                var response = await sender.Send(new UpdateApplicationScreeningStatusCommand(
                    jobId,
                    applicationId,
                    request.TargetStatus,
                    request.Reason,
                    request.ConcurrencyToken,
                    userId.Value), cancellationToken);
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("UpdateApplicationScreeningStatus")
        .WithSummary("Company cập nhật trạng thái sàng lọc hồ sơ")
        .WithDescription("Chỉ Client Company sở hữu Job mới được chuyển SUBMITTED sang SCREENING, SHORTLISTED, REJECTED hoặc BACKUP; SCREENING sang SHORTLISTED, REJECTED hoặc BACKUP; BACKUP sang SHORTLISTED hoặc BACKUP_NOT_SELECTED.")
        .Produces<UpdateApplicationScreeningStatusResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // A01: GET /api/v1/recruitment/applications
        group.MapGet("/applications", async (
            [FromQuery] Guid? jobId,
            [FromQuery] string? status,
            [FromQuery] string? candidateName,
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
            var isInternal = PermissionAuthorization.HasPermission(user, ViewAllPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ViewAllPermission);
            }

            try
            {
                var query = new GetRecruitmentApplicationsQuery(
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    JobId: jobId,
                    Status: status,
                    CandidateName: candidateName,
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
        .WithName("GetRecruitmentApplications")
        .WithSummary("Lấy danh sách hồ sơ tuyển dụng")
        .WithDescription("Dành cho Client Company (xem hồ sơ thuộc công ty mình qua quyền application.view_company), Internal HR và Admin (xem toàn hệ thống qua quyền application.view). Hỗ trợ lọc theo công việc, trạng thái, tên ứng viên, khoảng thời gian và phân trang.")
        .Produces<RecruitmentApplicationsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        // A02: GET /api/v1/recruitment/applications/{applicationId:guid}
        group.MapGet("/applications/{applicationId:guid}", async (
            Guid applicationId,
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
            var isInternal = PermissionAuthorization.HasPermission(user, ViewAllPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ViewAllPermission);
            }

            try
            {
                var query = new GetRecruitmentApplicationDetailQuery(
                    applicationId,
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin
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
        .WithName("GetRecruitmentApplicationDetail")
        .WithSummary("Lấy chi tiết hồ sơ tuyển dụng")
        .WithDescription("Dành cho Client Company (chỉ xem hồ sơ của công ty mình qua quyền application.view_company), Internal HR và Admin (xem qua quyền application.view). Trả về đầy đủ thông tin ứng viên, CV, tóm tắt phỏng vấn, offer, thông tin tiếp nhận việc và các hành động được phép (allowedActions).")
        .Produces<RecruitmentApplicationDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // A03: GET /api/v1/recruitment/applications/{applicationId:guid}/timeline
        group.MapGet("/applications/{applicationId:guid}/timeline", async (
            Guid applicationId,
            [FromQuery] bool ascending = true,
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
            var isInternal = PermissionAuthorization.HasPermission(user, ViewAllPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ViewAllPermission);
            }

            try
            {
                var query = new GetRecruitmentApplicationTimelineQuery(
                    applicationId,
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    Ascending: ascending
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
        .WithName("GetRecruitmentApplicationTimeline")
        .WithSummary("Lấy dòng thời gian / lịch sử hồ sơ tuyển dụng")
        .WithDescription("Dành cho Client Company (xem hồ sơ công ty mình qua quyền application.view_company), Internal HR và Admin (qua quyền application.view). Tập hợp toàn bộ sự kiện từ lúc nộp đơn, đổi trạng thái, lên lịch/kết quả phỏng vấn, offer đến tiếp nhận việc.")
        .Produces<RecruitmentApplicationTimelineResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // A04: POST /api/v1/recruitment/applications/{id:guid}/backup-decision
        group.MapPost("/applications/{id:guid}/backup-decision", async (
            Guid id,
            [FromBody] DecideBackupApplicationRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var hasPermission = PermissionAuthorization.HasPermission(user, DecideBackupPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!hasPermission && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(DecideBackupPermission);
            }

            var isInternalOrAdmin = user.IsInRole("INTERNAL_HR") || isAdmin || PermissionAuthorization.HasPermission(user, "application.view");
            var isClient = !isInternalOrAdmin;

            try
            {
                var command = new DecideBackupApplicationCommand(
                    ApplicationId: id,
                    Decision: request.Decision,
                    Reason: request.Reason,
                    Note: request.Note,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: isClient,
                    IsInternalHrOrAdmin: isInternalOrAdmin
                );

                var response = await sender.Send(command, cancellationToken);
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("DecideBackupApplication")
        .WithSummary("Quyết định chọn hoặc xử lý ứng viên dự phòng (Backup candidate)")
        .WithDescription("Dành cho Client Company HR / Admin hoặc Internal HR (quyền application.decide_backup). Chọn ứng viên dự phòng chuyển hồ sơ sang OFFER_PENDING; có thể từ chối hoặc tiếp tục giữ làm dự phòng.")
        .Produces<DecideBackupApplicationResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // A05: POST /api/v1/recruitment/applications/{applicationId:guid}/withdraw
        group.MapPost("/applications/{applicationId:guid}/withdraw", async (
            Guid applicationId,
            [FromBody] WithdrawApplicationRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, WithdrawOwnPermission))
            {
                return PermissionAuthorization.Forbidden(WithdrawOwnPermission);
            }

            try
            {
                var response = await sender.Send(new WithdrawApplicationCommand(
                    applicationId,
                    request.Reason,
                    request.ConcurrencyToken,
                    userId.Value), cancellationToken);
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
        .WithName("WithdrawApplication")
        .WithSummary("Ứng viên rút hồ sơ ứng tuyển của mình")
        .Produces<WithdrawApplicationResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // O03: POST /api/v1/recruitment/applications/{applicationId:guid}/offers
        group.MapPost("/applications/{applicationId:guid}/offers", async (
            Guid applicationId,
            [FromBody] CreateOfferDraftRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, CreateOfferPermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManageOfferPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(CreateOfferPermission);
            }

            try
            {
                var command = new CreateOfferDraftCommand(
                    ApplicationId: applicationId,
                    Salary: request.Salary,
                    CurrencyCode: request.CurrencyCode,
                    StartDate: request.StartDate,
                    ExpiryDate: request.ExpiryDate,
                    OfferDocumentUrl: request.OfferDocumentUrl,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin
                );

                var response = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/v1/offers/{response.OfferId}", response);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("CreateOfferDraft")
        .WithSummary("Tạo thư mời nhận việc bản nháp (Create Offer Draft)")
        .WithDescription("Dành cho Client Company HR / Admin (offer.create) hoặc Internal HR / Admin (offer.manage). Chỉ tạo bản nháp thư mời nhận việc khi hồ sơ đang ở trạng thái OFFER_PENDING.")
        .Produces<CreateOfferDraftResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // P01: PUT /api/v1/recruitment/applications/{applicationId:guid}/planned-start-date
        group.MapPut("/applications/{applicationId:guid}/planned-start-date", async (
            Guid applicationId,
            [FromBody] ConfirmPlannedStartDateRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, PlacementConfirmPermission);
            var isInternal = PermissionAuthorization.HasPermission(user, "placement.manage") ||
                             PermissionAuthorization.HasPermission(user, ViewAllPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(PlacementConfirmPermission);
            }

            var isInternalOrAdmin = user.IsInRole("INTERNAL_HR") || isAdmin || isInternal;
            var isClientUser = !isInternalOrAdmin;

            try
            {
                var command = new ConfirmPlannedStartDateCommand(
                    ApplicationId: applicationId,
                    PlannedStartDate: request.PlannedStartDate,
                    Reason: request.Reason,
                    ConcurrencyToken: request.ExpectedApplicationVersion ?? request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: isClientUser,
                    IsInternalHrOrAdmin: isInternalOrAdmin
                );

                var response = await sender.Send(command, cancellationToken);
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("ConfirmPlannedStartDate")
        .WithSummary("Cập nhật ngày dự kiến nhận việc (Confirm Planned Start Date)")
        .WithDescription("Dành cho Client Company HR / Admin (placement.confirm) hoặc Internal HR / Admin (placement.manage hoặc application.view). Chỉ cập nhật ngày dự kiến nhận việc khi hồ sơ đã ở trạng thái OFFER_ACCEPTED.")
        .Produces<ConfirmPlannedStartDateResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // P02: POST /api/v1/recruitment/applications/{applicationId:guid}/start-work
        group.MapPost("/applications/{applicationId:guid}/start-work", async (
            Guid applicationId,
            [FromBody] ConfirmStartWorkRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var hasConfirm = PermissionAuthorization.HasPermission(user, PlacementConfirmPermission);
            var hasManage = PermissionAuthorization.HasPermission(user, "placement.manage");
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!hasConfirm && !hasManage && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(PlacementConfirmPermission);
            }

            var isInternalOrAdmin = user.IsInRole("INTERNAL_HR") || isAdmin || hasManage;
            var isClientUser = !isInternalOrAdmin;

            try
            {
                var command = new ConfirmStartWorkCommand(
                    ApplicationId: applicationId,
                    OfferId: request.OfferId,
                    ActualStartDate: request.ActualStartDate,
                    ConfirmationNote: request.ConfirmationNote ?? request.Note,
                    Position: request.Position,
                    Department: request.Department,
                    ConcurrencyToken: request.ExpectedApplicationVersion ?? request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: isClientUser,
                    IsInternalHrOrAdmin: isInternalOrAdmin
                );

                var response = await sender.Send(command, cancellationToken);
                return Results.Ok(new
                {
                    success = true,
                    message = "Đã xác nhận bắt đầu làm việc.",
                    data = response
                });
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("ConfirmStartWork")
        .WithSummary("Xác nhận ứng viên thực tế đi làm (Confirm Start Work & Create Placement)")
        .WithDescription("Dành cho Client Company HR / Admin (placement.confirm) hoặc Internal HR / Admin (placement.manage). Thực hiện một transaction: xác nhận đi làm, tạo bản ghi Placement, chuyển trạng thái hồ sơ sang PLACED và ghi nhận lịch sử trạng thái.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // P03: POST /api/v1/recruitment/applications/{applicationId:guid}/not-started
        group.MapPost("/applications/{applicationId:guid}/not-started", async (
            Guid applicationId,
            [FromBody] MarkNotStartedRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var hasMarkPermission = PermissionAuthorization.HasPermission(user, MarkNotStartedPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!hasMarkPermission && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(MarkNotStartedPermission);
            }

            var isInternalOrAdmin = user.IsInRole("INTERNAL_HR") || isAdmin || PermissionAuthorization.HasPermission(user, "placement.manage");
            var isClientUser = !isInternalOrAdmin;

            try
            {
                var command = new MarkNotStartedCommand(
                    ApplicationId: applicationId,
                    Reason: request.Reason,
                    ConcurrencyToken: request.ExpectedApplicationVersion ?? request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: isClientUser,
                    IsInternalHrOrAdmin: isInternalOrAdmin
                );

                var response = await sender.Send(command, cancellationToken);
                return Results.Ok(new
                {
                    success = true,
                    message = "Đã đánh dấu ứng viên không nhận việc.",
                    data = response
                });
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("MarkNotStarted")
        .WithSummary("Đánh dấu ứng viên không nhận việc (Mark Candidate As Not Started)")
        .WithDescription("Dành cho Client Company HR / Admin hoặc Internal HR / Admin (application.mark_not_started). Cập nhật trạng thái hồ sơ sang NOT_STARTED khi ứng viên không đến nhận việc hoặc hủy nhận việc sau khi đã trúng tuyển/chấp thuận offer.")
        .Produces(StatusCodes.Status200OK)
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

public class DecideBackupApplicationRequest
{
    public string Decision { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}

public class UpdateApplicationScreeningStatusRequest
{
    public string TargetStatus { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}

public class CreateOfferDraftRequest
{
    public decimal? Salary { get; set; }
    public string? CurrencyCode { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? OfferDocumentUrl { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}

public class ConfirmPlannedStartDateRequest
{
    public DateOnly PlannedStartDate { get; set; }
    public string? Reason { get; set; }
    public Guid? ExpectedApplicationVersion { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}

public class ConfirmStartWorkRequest
{
    public Guid OfferId { get; set; }
    public DateOnly ActualStartDate { get; set; }
    public string? ConfirmationNote { get; set; }
    public string? Note { get; set; }
    public string? Position { get; set; }
    public string? Department { get; set; }
    public Guid? ExpectedApplicationVersion { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}

public class MarkNotStartedRequest
{
    public string Reason { get; set; } = string.Empty;
    public Guid? ExpectedApplicationVersion { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}

public class WithdrawApplicationRequest
{
    public string? Reason { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}
