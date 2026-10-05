using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;
using HRConnect.Application.Features.SubmissionConsents.RespondSubmissionConsent;
using MediatR;

namespace HRConnect.Presentation.Endpoints.V1.SubmissionConsents;

public static class SubmissionConsentEndpoints
{
    public static IEndpointRouteBuilder MapSubmissionConsentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/submission-consent", (HttpContext context) =>
        {
            context.Response.Headers["Cache-Control"] = "no-store";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            context.Response.Headers["Content-Security-Policy"] =
                "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
                "connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
            return Results.Content(SubmissionConsentPage.Html, "text/html; charset=utf-8");
        })
        .AllowAnonymous()
        .ExcludeFromDescription();

        var group = app.MapGroup("/api/v1/submission-consents")
            .WithTags("Submission Consents")
            .AllowAnonymous()
            .RequireRateLimiting("submission-consent-public");

        group.MapPost("/review", async (
            ConsentTokenRequest request,
            ClaimsPrincipal user,
            ISender sender,
            CancellationToken cancellationToken) =>
            await Run(() => sender.Send(
                new GetSubmissionConsentQuery(request.Token, null, UserId(user)), cancellationToken)))
            .WithName("ReviewSubmissionConsent")
            .WithSummary("Candidate xem yêu cầu xác nhận hồ sơ")
            .WithDescription("Dành cho Candidate chưa có tài khoản. Token một lần từ email được gửi trong request body để tránh xuất hiện trong access log. Candidate đã có tài khoản dùng API có Bearer tại nhóm Candidate Submission Consents. CV được trả bằng URL tạm thời 5 phút.")
            .Produces<SubmissionConsentReviewResponse>()
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status429TooManyRequests);

        group.MapPost("/respond", async (
            ConsentDecisionRequest request,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ISender sender,
            IValidator<RespondSubmissionConsentCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var command = new RespondSubmissionConsentCommand
            {
                Token = request.Token,
                Decision = request.Decision,
                AllowFutureReuse = request.AllowFutureReuse,
                RequesterUserId = UserId(user),
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = httpContext.Request.Headers.UserAgent.ToString()
            };
            var validation = await validator.ValidateAsync(command, cancellationToken);
            if (!validation.IsValid) return Results.ValidationProblem(validation.ToDictionary());
            return await Run(() => sender.Send(command, cancellationToken));
        })
            .WithName("RespondSubmissionConsent")
            .WithSummary("Candidate đồng ý hoặc từ chối hồ sơ do Affiliate nộp")
            .WithDescription("Dành cho Candidate chưa có tài khoản. Token một lần từ email và decision CONFIRM hoặc DECLINE là bắt buộc. Khi CONFIRM, allowFutureReuse là lựa chọn cho phép đúng Affiliate đã tải CV tạo yêu cầu consent mới cho Job khác; mỗi Job vẫn cần Candidate đồng ý riêng. Candidate đã có tài khoản dùng API có Bearer tại nhóm Candidate Submission Consents.")
            .Produces<RespondSubmissionConsentResponse>()
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status429TooManyRequests);

        var candidateGroup = app.MapGroup("/api/v1/candidates/me/submission-consents")
            .WithTags("Candidate Submission Consents")
            .RequireAuthorization()
            .RequireRateLimiting("submission-consent");

        candidateGroup.MapGet("/{submissionId:guid}", async (
            Guid submissionId,
            ClaimsPrincipal user,
            ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = UserId(user);
            if (!userId.HasValue) return Results.Unauthorized();
            return await Run(() => sender.Send(
                new GetSubmissionConsentQuery(null, submissionId, userId), cancellationToken));
        })
            .WithName("ReviewAuthenticatedCandidateSubmissionConsent")
            .WithSummary("Candidate đã đăng nhập xem yêu cầu xác nhận")
            .WithDescription("Dùng Bearer token qua nút Authorize và submissionId từ notification/lịch sử. Không cần token email. Chỉ Candidate sở hữu hồ sơ mới được xem; CV được trả bằng URL tạm thời 5 phút.")
            .Produces<SubmissionConsentReviewResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status429TooManyRequests);

        candidateGroup.MapPost("/{submissionId:guid}/respond", async (
            Guid submissionId,
            CandidateConsentDecisionRequest request,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ISender sender,
            IValidator<RespondSubmissionConsentCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = UserId(user);
            if (!userId.HasValue) return Results.Unauthorized();
            var command = new RespondSubmissionConsentCommand
            {
                SubmissionId = submissionId,
                Decision = request.Decision,
                AllowFutureReuse = request.AllowFutureReuse,
                RequesterUserId = userId,
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = httpContext.Request.Headers.UserAgent.ToString()
            };
            var validation = await validator.ValidateAsync(command, cancellationToken);
            if (!validation.IsValid) return Results.ValidationProblem(validation.ToDictionary());
            return await Run(() => sender.Send(command, cancellationToken));
        })
            .WithName("RespondAuthenticatedCandidateSubmissionConsent")
            .WithSummary("Candidate đã đăng nhập đồng ý hoặc từ chối hồ sơ")
            .WithDescription("Dùng Bearer token qua nút Authorize và submissionId; không cần token email. Khi CONFIRM, allowFutureReuse là lựa chọn cho phép đúng Affiliate đã tải CV tạo yêu cầu consent mới cho Job khác; mỗi Job vẫn cần Candidate đồng ý riêng. Application, Attribution và hàng đợi MF03 được tạo trong cùng transaction.")
            .Produces<RespondSubmissionConsentResponse>()
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status429TooManyRequests);

        return app;
    }

    private static Guid? UserId(ClaimsPrincipal user) =>
        user.Identity?.IsAuthenticated == true &&
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id)
            ? id
            : null;

    private static async Task<IResult> Run<T>(Func<Task<T>> action)
    {
        try { return Results.Ok(await action()); }
        catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
        catch (ForbiddenException ex) { return Results.Json(new { success = false, message = ex.Message }, statusCode: 403); }
        catch (ConflictException ex) { return Results.Conflict(new { success = false, message = ex.Message }); }
        catch (BadRequestException ex) { return Results.BadRequest(new { success = false, message = ex.Message }); }
    }

    public sealed record ConsentTokenRequest(string Token);
    public sealed record ConsentDecisionRequest(string Token, string Decision, bool? AllowFutureReuse);
    public sealed record CandidateConsentDecisionRequest(string Decision, bool? AllowFutureReuse);
}
