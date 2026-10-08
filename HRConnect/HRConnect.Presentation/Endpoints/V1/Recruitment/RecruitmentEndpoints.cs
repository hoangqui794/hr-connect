using System;
using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Offers.Commands.CreateOfferDraft;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmPlannedStartDate;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;
using HRConnect.Application.Features.Recruitment.Commands.DecideBackupApplication;
using HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;
using HRConnect.Application.Features.Recruitment.Commands.StartScreening;
using HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;
using HRConnect.Application.Features.Recruitment.Commands.WithdrawApplication;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;
using HRConnect.Application.Features.Recruitment.Queries.GetApplicationCvDownloadUrl;
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
    private const string PlacementConfirmPermission = "placement.confirm";
    private const string MarkNotStartedPermission = "application.mark_not_started";
    private const string WithdrawOwnPermission = "application.withdraw_own";
    private const string ReviewCompanyPermission = "candidate.review_company";
    private const string ScreenApplicationPermission = "application.screen";

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
            [FromServices] IValidator<UpdateApplicationScreeningStatusCommand> validator,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (ResolveScreeningActor(user) is not { } actor)
            {
                return PermissionAuthorization.Forbidden($"{ReviewCompanyPermission} | {ScreenApplicationPermission}");
            }

            var command = new UpdateApplicationScreeningStatusCommand(
                jobId,
                applicationId,
                request.TargetStatus,
                request.Reason,
                request.ReasonCode,
                request.ConcurrencyToken,
                userId.Value,
                actor);
            var validation = await validator.ValidateAsync(command, cancellationToken);
            if (!validation.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu không hợp lệ.",
                    errors = validation.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
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
        .WithName("UpdateApplicationScreeningStatus")
        .WithSummary("Cập nhật trạng thái sàng lọc hồ sơ (MF-03)")
        .WithDescription("Người sàng lọc theo loại dịch vụ: CV_APPLICATION do Client Company sở hữu Job (candidate.review_company); HEADHUNT_COD và CV_SOURCING do Internal HR (application.screen). Internal HR chỉ tiền sàng lọc từ SUBMITTED hoặc SCREENING sang SCREENING, SHORTLISTED hoặc REJECTED; Client Company mới được đưa hồ sơ vào BACKUP và quyết định backup. REJECTED bắt buộc reasonCode (OTHER thì phải có reason làm ghi chú); concurrencyToken bắt buộc.")
        .Produces<UpdateApplicationScreeningStatusResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        companyJobGroup.MapPost("/{jobId:guid}/applications/{applicationId:guid}/start-screening", async (
            Guid jobId,
            Guid applicationId,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (ResolveScreeningActor(user) is not { } actor)
            {
                return PermissionAuthorization.Forbidden($"{ReviewCompanyPermission} | {ScreenApplicationPermission}");
            }

            try
            {
                var response = await sender.Send(
                    new StartScreeningCommand(jobId, applicationId, userId.Value, actor), cancellationToken);
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
        })
        .WithName("StartApplicationScreening")
        .WithSummary("Đánh dấu hồ sơ đang được sàng lọc (MF-03)")
        .WithDescription("Giao diện gọi khi người sàng lọc mở hồ sơ. Gọi lặp lại không sao: chỉ chuyển SUBMITTED sang SCREENING khi người gọi đúng là người sàng lọc theo loại dịch vụ; các trường hợp khác trả về trạng thái hiện tại với changed = false.")
        .Produces<StartScreeningResponse>(StatusCodes.Status200OK)
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
            [FromQuery] string? sortBy = null,
            [FromQuery] string? sortDirection = null,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = user.IsInRole("CLIENT_COMPANY_USER")
                && PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = user.IsInRole("INTERNAL_HR")
                && PermissionAuthorization.HasPermission(user, ViewAllPermission);
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
                    PageSize: pageSize,
                    SortBy: sortBy,
                    SortDirection: sortDirection
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
        .WithDescription("Dành cho Client Company (xem hồ sơ thuộc công ty mình qua quyền application.view_company), Internal HR và Admin (xem toàn hệ thống qua quyền application.view). Hỗ trợ lọc theo công việc, trạng thái, tên ứng viên, khoảng thời gian, phân trang và sortBy=AI_MATCH_SCORE với sortDirection=ASC hoặc DESC.")
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

            var isClient = user.IsInRole("CLIENT_COMPANY_USER")
                && PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = user.IsInRole("INTERNAL_HR")
                && PermissionAuthorization.HasPermission(user, ViewAllPermission);
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
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    ScreeningActor: ResolveScreeningActor(user)
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

        // GET /api/v1/recruitment/applications/{applicationId:guid}/cv/download-url
        group.MapGet("/applications/{applicationId:guid}/cv/download-url", async (
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

            var isClient = user.IsInRole("CLIENT_COMPANY_USER")
                && PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = user.IsInRole("INTERNAL_HR")
                && PermissionAuthorization.HasPermission(user, ViewAllPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ViewAllPermission);
            }

            try
            {
                var query = new GetApplicationCvDownloadUrlQuery(
                    applicationId,
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin);

                return Results.Ok(await sender.Send(query, cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
        })
        .WithName("GetApplicationCvDownloadUrl")
        .WithSummary("Lấy đường dẫn tạm thời để xem CV của hồ sơ tuyển dụng")
        .WithDescription("Dành cho Client Company (hồ sơ thuộc công ty mình và đang hiển thị với Client), Internal HR và Admin. Áp dụng cùng quy tắc che thông tin của MF-03: với dịch vụ HEADHUNT_COD, Client chỉ xem được CV sau khi ứng viên đi làm (403 trước đó). Đường dẫn có hiệu lực 10 phút và mỗi lần cấp đều ghi audit log.")
        .Produces<GetApplicationCvDownloadUrlResponse>(StatusCodes.Status200OK)
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

            if (!hasPermission)
            {
                return PermissionAuthorization.Forbidden(DecideBackupPermission);
            }

            try
            {
                var command = new DecideBackupApplicationCommand(
                    ApplicationId: id,
                    Decision: request.Decision,
                    Reason: request.Reason,
                    Note: request.Note,
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền application.decide_backup được chọn, loại hoặc giữ ứng viên dự phòng. Chọn ứng viên dự phòng chuyển hồ sơ sang OFFER_PENDING.")
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

            if (!isClient)
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
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền offer.create được tạo bản nháp khi hồ sơ ở trạng thái OFFER_PENDING.")
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

            if (!isClient)
            {
                return PermissionAuthorization.Forbidden(PlacementConfirmPermission);
            }

            try
            {
                var command = new ConfirmPlannedStartDateCommand(
                    ApplicationId: applicationId,
                    PlannedStartDate: request.PlannedStartDate,
                    Reason: request.Reason,
                    ConcurrencyToken: request.ExpectedApplicationVersion ?? request.ConcurrencyToken,
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền placement.confirm được cập nhật ngày dự kiến nhận việc khi hồ sơ đã ở trạng thái OFFER_ACCEPTED.")
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

            if (!hasConfirm)
            {
                return PermissionAuthorization.Forbidden(PlacementConfirmPermission);
            }

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
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền placement.confirm được xác nhận đi làm. API tạo Placement, chuyển hồ sơ sang PLACED và ghi nhận lịch sử trạng thái trong một transaction.")
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

            if (!hasMarkPermission)
            {
                return PermissionAuthorization.Forbidden(MarkNotStartedPermission);
            }

            try
            {
                var command = new MarkNotStartedCommand(
                    ApplicationId: applicationId,
                    Reason: request.Reason,
                    ConcurrencyToken: request.ExpectedApplicationVersion ?? request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền application.mark_not_started được đánh dấu ứng viên không nhận việc sau khi ứng viên chấp thuận offer.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        return app;
    }

    /// <summary>
    /// Resolve a screening actor only for the corresponding operational role. Platform
    /// administrators can monitor recruitment but cannot screen applications.
    /// </summary>
    private static ScreeningActor? ResolveScreeningActor(ClaimsPrincipal user)
    {
        if (user.IsInRole("PLATFORM_ADMIN")) return null;
        if (user.IsInRole("INTERNAL_HR")
            && PermissionAuthorization.HasPermission(user, ScreenApplicationPermission)) return ScreeningActor.InternalHr;
        if (user.IsInRole("CLIENT_COMPANY_USER")
            && PermissionAuthorization.HasPermission(user, ReviewCompanyPermission)) return ScreeningActor.ClientCompany;
        return null;
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

    /// <summary>Optional free-text note. Required only when reasonCode is OTHER.</summary>
    public string? Reason { get; set; }

    /// <summary>Required for REJECTED: SKILL_MISMATCH, INSUFFICIENT_EXPERIENCE, SALARY_MISMATCH, LOCATION_MISMATCH, LANGUAGE_REQUIREMENT, CANDIDATE_UNREACHABLE, POSITION_FILLED, OTHER.</summary>
    public string? ReasonCode { get; set; }
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
