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
                new GetSubmissionConsentQuery(request.Token, UserId(user)), cancellationToken)))
            .WithName("ReviewSubmissionConsent")
            .WithSummary("Candidate xem yêu cầu xác nhận hồ sơ")
            .WithDescription("Bearer tùy chọn. Token được gửi trong request body để tránh xuất hiện trong access log. Candidate đã có tài khoản phải Authorize bằng đúng tài khoản; Candidate chưa có tài khoản dùng token email. CV được trả bằng URL tạm thời 5 phút.")
            .Produces<SubmissionConsentReviewResponse>()
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status429TooManyRequests);

        group.MapPost("/respond", async (
            RespondSubmissionConsentCommand command,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ISender sender,
            IValidator<RespondSubmissionConsentCommand> validator,
            CancellationToken cancellationToken) =>
        {
            command.RequesterUserId = UserId(user);
            command.IpAddress = httpContext.Connection.RemoteIpAddress?.ToString();
            command.UserAgent = httpContext.Request.Headers.UserAgent.ToString();
            var validation = await validator.ValidateAsync(command, cancellationToken);
            if (!validation.IsValid) return Results.ValidationProblem(validation.ToDictionary());
            return await Run(() => sender.Send(command, cancellationToken));
        })
            .WithName("RespondSubmissionConsent")
            .WithSummary("Candidate đồng ý hoặc từ chối hồ sơ do Affiliate nộp")
            .WithDescription("Bearer tùy chọn. Decision nhận CONFIRM hoặc DECLINE. Candidate đã có tài khoản phải Authorize đúng tài khoản. CONFIRM kiểm tra trùng lần cuối rồi mới tạo Application, Attribution và hàng đợi MF03 trong cùng transaction.")
            .Produces<RespondSubmissionConsentResponse>()
            .Produces(StatusCodes.Status400BadRequest)
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
}
