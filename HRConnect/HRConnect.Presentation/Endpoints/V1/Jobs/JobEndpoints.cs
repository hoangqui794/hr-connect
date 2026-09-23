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
        }).WithName("UpdateJob").WithSummary("Cập nhật Job Draft hoặc Job bị từ chối");

        jobs.MapPost("/{jobId:guid}/submit", async (Guid jobId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
            await ClientAction(user, "job.update_own", id => sender.Send(new SubmitJobCommand { JobId = jobId, UserId = id }, ct))
        ).WithName("SubmitJob").WithSummary("Gửi Job để Internal HR xét duyệt");
        jobs.MapPost("/{jobId:guid}/pause", async (Guid jobId, ClaimsPrincipal user, [FromBody] PauseJobCommand command, ISender sender, CancellationToken ct) =>
        { command.JobId = jobId; return await ClientAction(user, "job.update_own", id => { command.UserId = id; return sender.Send(command, ct); }); }
        ).WithName("PauseJob").WithSummary("Tạm dừng Job đang hoạt động");
        jobs.MapPost("/{jobId:guid}/resume", async (Guid jobId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
            await ClientAction(user, "job.update_own", id => sender.Send(new ResumeJobCommand { JobId = jobId, UserId = id }, ct))
        ).WithName("ResumeJob").WithSummary("Tiếp tục Job đang tạm dừng");
        jobs.MapPost("/{jobId:guid}/close", async (Guid jobId, ClaimsPrincipal user, [FromBody] CloseJobCommand command, ISender sender, IValidator<CloseJobCommand> validator, CancellationToken ct) =>
        {
            command.JobId = jobId; var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ClientCan(user, "job.update_own")) return Forbidden(); command.UserId = id.Value;
            var invalid = await Validate(command, validator, ct); return invalid ?? await Run(async () => Results.Ok(await sender.Send(command, ct)));
        }
        ).WithName("CloseJob").WithSummary("Đóng Job");

        jobs.MapGet("/mine", async (ClaimsPrincipal user, string? status, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ClientCan(user, "job.view_own")) return Forbidden();
            return await Run(async () => Results.Ok(await sender.Send(new GetMyJobsQuery(id.Value, status), ct)));
        }
        ).WithName("GetMyJobs").WithSummary("Lấy danh sách Job của doanh nghiệp hiện tại");
        jobs.MapGet("", async (ClaimsPrincipal user, string? search, string? location, string? employmentType,
            int page, int pageSize, ISender sender, CancellationToken ct) =>
        {
            if (!user.HasClaim("permission", "job.view")) return Forbidden();
            return await Run(async () => Results.Ok(await sender.Send(new GetPublicJobsQuery(
                RoleCodes(user), search, location, employmentType,
                page <= 0 ? 1 : page, pageSize <= 0 ? 20 : pageSize), ct)));
        }).WithName("GetPublicJobs").WithSummary("Tìm Job đang hoạt động theo quyền xem của Service Type");
        jobs.MapGet("/{jobId:guid}", async (Guid jobId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized();
            var internalAccess = ReviewerCan(user, "job.review") || (user.IsInRole("PLATFORM_ADMIN") && user.HasClaim("permission", "job.view"));
            var canAttemptView = internalAccess || ClientCan(user, "job.view_own") || user.HasClaim("permission", "job.view");
            if (!canAttemptView) return Forbidden();
            return await Run(async () => Results.Ok(await sender.Send(new GetJobDetailQuery(jobId, id.Value, internalAccess, RoleCodes(user)), ct)));
        }
        ).WithName("GetJobDetail").WithSummary("Lấy chi tiết Job");

        // POST /api/v1/jobs/{jobId}/apply - Ứng viên tự ứng tuyển vào công việc
        jobs.MapPost("/{jobId:guid}/apply", async (
            Guid jobId,
            ClaimsPrincipal user,
            [FromForm] Guid? cvId,
            IFormFile? file,
            ISender sender,
            CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();

            var command = new ApplyJobCommand
            {
                JobId = jobId,
                UserId = id.Value,
                RoleCodes = RoleCodes(user),
                CvId = cvId,
                FileStream = file?.OpenReadStream(),
                FileName = file?.FileName,
                ContentType = file?.ContentType,
                FileSizeBytes = file?.Length
            };

            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithTags("Candidate Applications")
        .WithName("CandidateApplyJob")
        .WithSummary("Ứng viên tự ứng tuyển vào Job")
        .WithDescription("Ứng viên nộp hồ sơ vào công việc bằng CV có sẵn hoặc tải lên tệp CV PDF mới. Hệ thống kiểm tra trùng lặp và phân quyền submit của Service Type.")
        .DisableAntiforgery()
        .Produces<ApplyJobResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // POST /api/v1/jobs/{jobId}/candidate-submissions - Affiliate Recruiter nộp hồ sơ ứng viên
        jobs.MapPost("/{jobId:guid}/candidate-submissions", async (
            Guid jobId,
            ClaimsPrincipal user,
            [FromForm] string fullName,
            [FromForm] string? email,
            [FromForm] string? phone,
            [FromForm] Guid? cvId,
            [FromForm] string? note,
            IFormFile? file,
            ISender sender,
            IValidator<SubmitCandidateCommand> validator,
            CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();

            var command = new SubmitCandidateCommand
            {
                JobId = jobId,
                UserId = id.Value,
                RoleCodes = RoleCodes(user),
                FullName = fullName ?? string.Empty,
                Email = email,
                Phone = phone,
                CvId = cvId,
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
        .WithDescription("Đối tác tuyển dụng (Affiliate) nộp hồ sơ ứng viên vào công việc. Hệ thống tự động nhận diện ứng viên theo email/sđt, kiểm tra trùng lặp, xác thực quyền hạn Service Type và ghi nhận Attribution.")
        .DisableAntiforgery()
        .Produces<SubmitCandidateResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        review.MapGet("/review", async (ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        { if (!ReviewerCan(user, "job.review")) return Forbidden(); return await Run(async () => Results.Ok(await sender.Send(new GetJobsForReviewQuery(), ct))); }
        ).WithName("GetJobsForReview").WithSummary("Lấy hàng đợi Job chờ xét duyệt");
        review.MapPost("/{jobId:guid}/approve", async (Guid jobId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ReviewerCan(user, "job.publish")) return Forbidden();
            return await Run(async () => Results.Ok(await sender.Send(new ApproveJobCommand { JobId = jobId, UserId = id.Value }, ct)));
        }
        ).WithName("ApproveJob").WithSummary("Duyệt và công bố Job");
        review.MapPost("/{jobId:guid}/reject", async (Guid jobId, ClaimsPrincipal user, [FromBody] RejectJobCommand command, ISender sender, IValidator<RejectJobCommand> validator, CancellationToken ct) =>
        {
            var id = UserId(user); if (id == null) return Results.Unauthorized(); if (!ReviewerCan(user, "job.review")) return Forbidden(); command.JobId = jobId; command.UserId = id.Value;
            var invalid = await Validate(command, validator, ct); return invalid ?? await Run(async () => Results.Ok(await sender.Send(command, ct)));
        }
        ).WithName("RejectJob").WithSummary("Từ chối Job và trả lý do");
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
        catch (BadRequestException ex) { return Results.BadRequest(new { success = false, message = ex.Message }); }
    }
    private static Guid? UserId(ClaimsPrincipal user) => Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id) ? id : null;
    private static bool ClientCan(ClaimsPrincipal user, string permission) => user.IsInRole("CLIENT_COMPANY_USER") && user.HasClaim("permission", permission);
    private static bool ReviewerCan(ClaimsPrincipal user, string permission) => user.IsInRole("INTERNAL_HR") && user.HasClaim("permission", permission);
    private static string[] RoleCodes(ClaimsPrincipal user) =>
        user.FindAll(ClaimTypes.Role).Select(claim => claim.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    private static IResult Forbidden() => Results.Json(new { success = false, message = "Bạn không có quyền thực hiện thao tác này." }, statusCode: 403);
}
