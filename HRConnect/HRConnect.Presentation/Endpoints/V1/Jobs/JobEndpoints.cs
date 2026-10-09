using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.Commands.ApproveJob;
using HRConnect.Application.Features.Jobs.Commands.CloseJob;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Commands.PauseJob;
using HRConnect.Application.Features.Jobs.Commands.RejectJob;
using HRConnect.Application.Features.Jobs.Commands.ResumeJob;
using HRConnect.Application.Features.Jobs.Commands.SubmitJob;
using HRConnect.Application.Features.Jobs.Commands.UpdateJob;
using HRConnect.Application.Features.Candidates.Commands.ApplyJob;
using HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;
using HRConnect.Application.Features.Jobs.Queries.GetJobDetail;
using HRConnect.Application.Features.Jobs.Queries.GetJobsForReview;
using HRConnect.Application.Features.Jobs.Queries.GetMyJobs;
using HRConnect.Application.Features.Jobs.Queries.GetPublicJobs;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HRConnect.Presentation.Authorization;

namespace HRConnect.Presentation.Endpoints.V1.Jobs;

public static class JobEndpoints
{
    public static IEndpointRouteBuilder MapJobEndpoints(this IEndpointRouteBuilder app)
    {
        var jobs = app.MapGroup("/api/v1/jobs").WithTags("Jobs").RequireAuthorization();
        var review = app.MapGroup("/api/v1/internal/jobs").WithTags("Job Review").RequireAuthorization();

        jobs.MapPost("", async (ClaimsPrincipal user, [FromBody] CreateJobCommand command, ISender sender, IValidator<CreateJobCommand> validator, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ClientCan(user, "job.create")) return Forbidden();
            command.UserId = id.Value; var invalid = await Validate(command, validator, ct); if (invalid != null) return invalid;
            return await Run(async () => { var result = await sender.Send(command, ct); return Results.Created($"/api/v1/jobs/{result.Data.JobId}", result); });
        }).WithName("CreateJobDraft").WithSummary("Tạo bản nháp công việc").Produces<CreateJobResponse>(201);

        jobs.MapPut("/{jobId:guid}", async (Guid jobId, ClaimsPrincipal user, [FromBody] UpdateJobCommand command, ISender sender, IValidator<UpdateJobCommand> validator, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ClientCan(user, "job.update_own")) return Forbidden();
            command.JobId = jobId; command.UserId = id.Value; var invalid = await Validate(command, validator, ct); if (invalid != null) return invalid;
            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithName("UpdateJob")
        .WithSummary("Cập nhật Job nháp hoặc Job bị từ chối")
        .WithDescription("Chỉ Client sở hữu Job được cập nhật khi trạng thái là DRAFT hoặc REJECTED. Có thể đổi serviceTypeId nếu Job chưa phát sinh ứng tuyển hoặc đề cử ứng viên; nếu đã phát sinh, API trả 409 và phải giữ nguyên serviceTypeId.")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        jobs.MapPost("/{jobId:guid}/submit", async (Guid jobId, Guid concurrencyToken, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
            await ClientAction(user, "job.update_own", id => sender.Send(new SubmitJobCommand { JobId = jobId, UserId = id, ConcurrencyToken = concurrencyToken }, ct))
        ).WithName("SubmitJob").WithSummary("Gửi Job để Internal HR xét duyệt")
        .WithDescription("Chỉ Client sở hữu Job ở trạng thái DRAFT hoặc REJECTED được gửi duyệt. Phải gửi concurrencyToken mới nhất lấy từ Job detail. Job phải có tối thiểu một JobRequirement loại MUST_HAVE; JobSkill là không bắt buộc. Chuyển trạng thái sang PENDING_REVIEW.");
        jobs.MapPost("/{jobId:guid}/pause", async (Guid jobId, ClaimsPrincipal user, [FromBody] PauseJobCommand command, ISender sender, CancellationToken ct) =>
        { command.JobId = jobId; return await ClientAction(user, "job.update_own", id => { command.UserId = id; return sender.Send(command, ct); }); }
        ).WithName("PauseJob").WithSummary("Tạm dừng Job đang hoạt động")
        .WithDescription("Chỉ Client sở hữu Job. Chuyển ACTIVE sang PAUSED với ReasonCode tự động PAUSED_BY_CLIENT; có thể gửi ReasonText.");
        jobs.MapPost("/{jobId:guid}/resume", async (Guid jobId, Guid concurrencyToken, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
            await ClientAction(user, "job.update_own", id => sender.Send(new ResumeJobCommand { JobId = jobId, UserId = id, ConcurrencyToken = concurrencyToken }, ct))
        ).WithName("ResumeJob").WithSummary("Tiếp tục Job đang tạm dừng")
        .WithDescription("Chỉ Client sở hữu Job. Phải gửi concurrencyToken mới nhất lấy từ Job detail. Chuyển PAUSED sang ACTIVE.");
        jobs.MapPost("/{jobId:guid}/close", async (Guid jobId, ClaimsPrincipal user, [FromBody] CloseJobCommand command, ISender sender, IValidator<CloseJobCommand> validator, CancellationToken ct) =>
        {
            command.JobId = jobId; var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ClientCan(user, "job.update_own")) return Forbidden(); command.UserId = id.Value;
            var invalid = await Validate(command, validator, ct); return invalid ?? await Run(async () => Results.Ok(await sender.Send(command, ct)));
        }
        ).WithName("CloseJob").WithSummary("Đóng Job")
        .WithDescription("Chỉ Client sở hữu Job. Chỉ đóng được Job ACTIVE hoặc PAUSED; gửi ReasonCode (CLOSED_POSITION_FILLED, CLOSED_BY_CLIENT hoặc CLOSED_OTHER) và ReasonText; chuyển sang CLOSED.");

        jobs.MapGet("/mine", async (ClaimsPrincipal user, string? status, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ClientCan(user, "job.view_own")) return Forbidden();
            return await Run(async () => Results.Ok(await sender.Send(new GetMyJobsQuery(id.Value, status), ct)));
        }
        ).WithName("GetMyJobs").WithSummary("Lấy danh sách Job của doanh nghiệp hiện tại");
        jobs.MapGet("", async (ClaimsPrincipal user, string? search, string? location, string? employmentType,
            Guid? serviceTypeId, decimal? salaryMin, decimal? salaryMax, int? page, int? pageSize, ISender sender, CancellationToken ct) =>
        {
            if (!user.HasClaim("permission", "job.view")) return Forbidden();
            var internalAccess = ReviewerCan(user, "job.review");
            return await Run(async () => Results.Ok(await sender.Send(new GetPublicJobsQuery(
                RoleCodes(user), internalAccess, search, location, employmentType, serviceTypeId, salaryMin, salaryMax,
                page is > 0 ? page.Value : 1, pageSize is > 0 ? pageSize.Value : 20), ct)));
        }).WithName("GetPublicJobs").WithSummary("Tìm Job đang hoạt động theo quyền xem của Service Type")
        .WithDescription("Filters MF01: search, location, employmentType, serviceTypeId, salaryMin, salaryMax. page mặc định 1; pageSize mặc định 20 và tối đa 100.");
        jobs.MapGet("/{jobId:guid}", async (Guid jobId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized();
            var internalAccess = ReviewerCan(user, "job.review");
            var canAttemptView = internalAccess || ClientCan(user, "job.view_own") || user.HasClaim("permission", "job.view");
            if (!canAttemptView) return Forbidden();
            return await Run(async () => Results.Ok(await sender.Send(new GetJobDetailQuery(jobId, id.Value, internalAccess, RoleCodes(user)), ct)));
        }
        ).WithName("GetJobDetail").WithSummary("Lấy chi tiết Job");

        // POST /api/v1/jobs/{jobId}/apply - Ứng viên tự ứng tuyển vào công việc
        jobs.MapPost("/{jobId:guid}/apply", async (
            Guid jobId,
            ClaimsPrincipal user,
            [FromForm] string? cvId,
            IFormFile? file,
            ISender sender,
            IValidator<ApplyJobCommand> validator,
            CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            if (!PermissionAuthorization.HasPermission(user, "application.create"))
                return PermissionAuthorization.Forbidden("application.create");

            Guid? parsedCandidateCvId = null;
            if (!string.IsNullOrWhiteSpace(cvId))
            {
                if (!Guid.TryParse(cvId, out var validCvId))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["cvId"] = ["cvId phải là UUID hợp lệ hoặc để trống khi tải lên tệp CV mới."]
                    });
                }
                parsedCandidateCvId = validCvId;
            }

            var command = new ApplyJobCommand
            {
                JobId = jobId,
                UserId = id.Value,
                RoleCodes = RoleCodes(user),
                CvId = parsedCandidateCvId,
                FileStream = file?.OpenReadStream(),
                FileName = file?.FileName,
                ContentType = file?.ContentType,
                FileSizeBytes = file?.Length
            };

            var invalid = await Validate(command, validator, ct);
            if (invalid != null) return invalid;

            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithTags("Candidate Applications")
        .WithName("CandidateApplyJob")
        .WithSummary("Ứng viên tự ứng tuyển vào Job")
        .WithDescription("Yêu cầu permission application.create. Candidate và tài khoản phải còn ACTIVE, hồ sơ chưa archive/merge. Phải cung cấp đúng một nguồn CV: cvId trong kho của Candidate hoặc một tệp PDF mới. Không được gửi đồng thời cả hai. Giới hạn 10 yêu cầu mỗi giờ theo UserId + IP; dữ liệu không hợp lệ bị chặn trước khi upload CV.")
        .RequireRateLimiting("candidate-application")
        .DisableAntiforgery()
        .Produces<ApplyJobResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status429TooManyRequests);

        // POST /api/v1/jobs/{jobId}/candidate-submissions - Affiliate Recruiter nộp hồ sơ ứng viên
        jobs.MapPost("/{jobId:guid}/candidate-submissions", async (
            Guid jobId,
            ClaimsPrincipal user,
            [FromForm] string? candidateId,
            [FromForm] string? fullName,
            [FromForm] string? email,
            [FromForm] string? phone,
            [FromForm] string? cvId,
            [FromForm] string? note,
            IFormFile? file,
            ISender sender,
            IValidator<SubmitCandidateCommand> validator,
            CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            if (!PermissionAuthorization.HasPermission(user, "submission.create"))
                return PermissionAuthorization.Forbidden("submission.create");

            Guid? parsedCvId = null;
            if (!string.IsNullOrWhiteSpace(cvId))
            {
                if (!Guid.TryParse(cvId, out var validCvId))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["cvId"] = ["cvId phải là UUID hợp lệ hoặc để trống khi tải lên tệp CV mới."]
                    });
                }
                parsedCvId = validCvId;
            }

            Guid? parsedCandidateId = null;
            if (!string.IsNullOrWhiteSpace(candidateId))
            {
                if (!Guid.TryParse(candidateId, out var validCandidateId))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["candidateId"] = ["candidateId phải là UUID hợp lệ hoặc để trống khi nộp Candidate/CV mới."]
                    });
                }
                parsedCandidateId = validCandidateId;
            }

            var command = new SubmitCandidateCommand
            {
                JobId = jobId,
                UserId = id.Value,
                RoleCodes = RoleCodes(user),
                CandidateId = parsedCandidateId,
                FullName = fullName ?? string.Empty,
                Email = email,
                Phone = phone,
                CvId = parsedCvId,
                Note = note,
                FileStream = file?.OpenReadStream(),
                FileName = file?.FileName,
                ContentType = file?.ContentType,
                FileSizeBytes = file?.Length
            };

            var invalid = await Validate(command, validator, ct);
            if (invalid != null) return invalid;

            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithTags("Affiliate Submissions")
        .WithName("AffiliateSubmitCandidate")
        .WithSummary("Affiliate Recruiter nộp hồ sơ ứng viên vào Job")
        .WithDescription("Yêu cầu permission submission.create. Có hai chế độ: (1) nộp Candidate/CV mới bằng fullName, email và file PDF; (2) tái sử dụng kho bằng candidateId + cvId, không gửi file. Backend nhận diện Candidate bằng email hồ sơ hoặc email alias đã xác minh, vẫn bắt buộc email và số điện thoại cùng trỏ về một Candidate. Nếu Candidate đã có tài khoản, consent chỉ được gửi tới email chính đã xác minh của tài khoản; email Affiliate nhập không được dùng làm địa chỉ nhận tùy ý. Ở chế độ kho, backend tự lấy danh tính Candidate và chỉ chấp nhận CV ACTIVE do chính Affiliate tải, đã được Candidate xác nhận. Mỗi Job vẫn tạo consent mới; Application, Attribution và MF03 chỉ được tạo sau khi Candidate đồng ý.")
        .RequireRateLimiting("submission-consent")
        .DisableAntiforgery()
        .Produces<SubmitCandidateResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        review.MapGet("/review", async (string? status, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        { if (!ReviewerCan(user, "job.review")) return Forbidden(); return await Run(async () => Results.Ok(await sender.Send(new GetJobsForReviewQuery(status), ct))); }
        ).WithName("GetJobsForReview").WithSummary("Lấy danh sách Job cho Internal HR theo trạng thái xét duyệt (mặc định PENDING_REVIEW, hoặc ACTIVE, REJECTED, ALL...)");
        review.MapPost("/{jobId:guid}/approve", async (Guid jobId, Guid concurrencyToken, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ReviewerCan(user, "job.publish")) return Forbidden();
            return await Run(async () => Results.Ok(await sender.Send(new ApproveJobCommand { JobId = jobId, UserId = id.Value, ConcurrencyToken = concurrencyToken }, ct)));
        }
        ).WithName("ApproveJob").WithSummary("Duyệt và công bố Job")
        .WithDescription("Yêu cầu permission job.publish. Chỉ duyệt Job PENDING_REVIEW và chuyển sang ACTIVE.");
        review.MapPost("/{jobId:guid}/reject", async (Guid jobId, ClaimsPrincipal user, [FromBody] RejectJobCommand command, ISender sender, IValidator<RejectJobCommand> validator, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ReviewerCan(user, "job.review")) return Forbidden(); command.JobId = jobId; command.UserId = id.Value;
            var invalid = await Validate(command, validator, ct); return invalid ?? await Run(async () => Results.Ok(await sender.Send(command, ct)));
        }
        ).WithName("RejectJob").WithSummary("Từ chối Job và trả lý do")
        .WithDescription("Yêu cầu permission job.review. Chỉ từ chối Job PENDING_REVIEW; gửi ReasonCode (REJECTED_INCOMPLETE_DESCRIPTION, REJECTED_INCOMPLETE_REQUIREMENTS hoặc REJECTED_OTHER) và ReasonText. Job chuyển sang REJECTED và Client có thể sửa rồi gửi duyệt lại.");
        return app;
    }

    private static async Task<IResult> ClientAction<T>(ClaimsPrincipal user, string permission, Func<Guid, Task<T>> action)
    { var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ClientCan(user, permission)) return Forbidden(); return await Run(async () => Results.Ok(await action(id.Value))); }
    private static async Task<IResult?> Validate<T>(T command, IValidator<T> validator, CancellationToken ct)
    { var result = await validator.ValidateAsync(command, ct); return result.IsValid ? null : Results.ValidationProblem(result.ToDictionary()); }
    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
        catch (ForbiddenException ex) { return Results.Json(new { success = false, errorCode = ex.ErrorCode, message = ex.Message }, statusCode: 403); }
        catch (ConflictException ex) { return Results.Conflict(new { success = false, message = ex.Message }); }
        catch (DbUpdateConcurrencyException) { return Results.Conflict(new { success = false, message = "Job đã được thay đổi bởi người dùng khác. Hãy tải lại dữ liệu và thử lại." }); }
        catch (BadRequestException ex) { return Results.BadRequest(new { success = false, message = ex.Message }); }
    }
    private static Guid? UserId(ClaimsPrincipal user) => Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id) ? id : null;
    private static bool ClientCan(ClaimsPrincipal user, string permission) => user.IsInRole("CLIENT_COMPANY_USER") && user.HasClaim("permission", permission);
    private static bool ReviewerCan(ClaimsPrincipal user, string permission) =>
        (user.IsInRole("INTERNAL_HR") || user.IsInRole("PLATFORM_ADMIN")) &&
        user.HasClaim("permission", permission);
    private static string[] RoleCodes(ClaimsPrincipal user) =>
        user.FindAll(ClaimTypes.Role).Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    private static IResult Forbidden() => Results.Json(new { success = false, message = "Bạn không có quyền thực hiện thao tác này." }, statusCode: 403);
}
