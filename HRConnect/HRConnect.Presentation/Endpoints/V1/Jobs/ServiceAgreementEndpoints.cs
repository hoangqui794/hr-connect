using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.ServiceAgreements;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Presentation.Endpoints.V1.Jobs;

public static class ServiceAgreementEndpoints
{
    public static IEndpointRouteBuilder MapServiceAgreementEndpoints(this IEndpointRouteBuilder app)
    {
        var publicAgreements = app.MapGroup("/api/v1/public/service-agreements")
            .WithTags("Public Service Agreements")
            .AllowAnonymous();

        var jobAgreements = app.MapGroup("/api/v1/jobs/{jobId:guid}/service-agreement")
            .WithTags("Service Agreements")
            .RequireAuthorization();

        var jobAgreementHistory = app.MapGroup("/api/v1/jobs/{jobId:guid}/service-agreements")
            .WithTags("Service Agreements")
            .RequireAuthorization();

        var clientAgreements = app.MapGroup("/api/v1/client/jobs/{jobId:guid}/service-agreements/{agreementId:guid}")
            .WithTags("Client Service Agreements")
            .RequireAuthorization();

        var internalAgreements = app.MapGroup("/api/v1/internal/jobs/{jobId:guid}/service-agreements")
            .WithTags("Internal HR Service Agreements")
            .RequireAuthorization();

        // 1. Public verify endpoint
        publicAgreements.MapGet("/verify/{verificationCode}", async (string verificationCode, ISender sender, CancellationToken ct) =>
            await Run(async () => Results.Ok(await sender.Send(new VerifyServiceAgreementPublicQuery(verificationCode), ct))))
            .WithName("VerifyServiceAgreementPublic")
            .WithSummary("Tra cứu công khai tính toàn vẹn và hiệu lực của thỏa thuận dịch vụ")
            .RequireRateLimiting("public-read")
            .Produces<PublicServiceAgreementVerificationDto>(StatusCodes.Status200OK);

        // 2. Get current agreement
        jobAgreements.MapGet("", async (Guid jobId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            return await Run(async () => Results.Ok(await sender.Send(new GetServiceAgreementQuery(jobId), ct)));
        })
        .WithName("GetCurrentServiceAgreement")
        .WithSummary("Lấy thông tin thỏa thuận dịch vụ hiện hành của tin tuyển dụng")
        .Produces<ServiceAgreementDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound);

        // 3. Get agreement history
        jobAgreementHistory.MapGet("", async (Guid jobId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            return await Run(async () => Results.Ok(await sender.Send(new GetServiceAgreementHistoryQuery(jobId), ct)));
        })
        .WithName("GetServiceAgreementHistory")
        .WithSummary("Lấy lịch sử các phiên bản thỏa thuận dịch vụ của tin tuyển dụng")
        .Produces<IReadOnlyList<ServiceAgreementDto>>(StatusCodes.Status200OK);

        // 4. Download presigned PDF URL
        jobAgreementHistory.MapGet("/{agreementId:guid}/download-url", async (Guid jobId, Guid agreementId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            return await Run(async () => Results.Ok(await sender.Send(new GetServiceAgreementDownloadUrlQuery(jobId, agreementId), ct)));
        })
        .WithName("GetServiceAgreementDownloadUrl")
        .WithSummary("Lấy liên kết tải PDF thỏa thuận dịch vụ (có chữ ký nếu đã ký)")
        .Produces<AgreementDownloadUrlResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound);

        // 5. Internal HR creates/sends agreement proposal
        internalAgreements.MapPost("", async (Guid jobId, [FromBody] CreateServiceAgreementProposalCommand command, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            if (!ReviewerCan(user, "job.review") && !ReviewerCan(user, "job.publish")) return Forbidden();

            command.JobId = jobId;
            command.UserId = id.Value;
            return await Run(async () => Results.Created($"/api/v1/jobs/{jobId}/service-agreement", await sender.Send(command, ct)));
        })
        .WithName("CreateServiceAgreementProposal")
        .WithSummary("Internal HR / Admin tạo và gửi đề xuất thỏa thuận dịch vụ cho Client")
        .Produces<ServiceAgreementDto>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict);

        // 6. Client responds (ACCEPT / REQUEST_CHANGES)
        clientAgreements.MapPost("/response", async (Guid jobId, Guid agreementId, [FromBody] RespondRequestBody body, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            if (!user.IsInRole("CLIENT_COMPANY_USER")) return Forbidden();

            var command = new RespondToServiceAgreementCommand
            {
                JobId = jobId,
                AgreementId = agreementId,
                UserId = id.Value,
                ConcurrencyToken = body.ConcurrencyToken,
                Action = body.Action,
                ChangeRequestReason = body.ChangeRequestReason
            };

            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithName("RespondToServiceAgreement")
        .WithSummary("Client phản hồi thỏa thuận dịch vụ (Đồng ý hoặc Yêu cầu điều chỉnh)")
        .Produces<ServiceAgreementDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict);

        // 7. Client requests OTP challenge to sign
        clientAgreements.MapPost("/signature-challenges", async (Guid jobId, Guid agreementId, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            if (!user.IsInRole("CLIENT_COMPANY_USER")) return Forbidden();

            var command = new CreateSignatureChallengeCommand
            {
                JobId = jobId,
                AgreementId = agreementId,
                UserId = id.Value
            };

            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithName("CreateSignatureChallenge")
        .WithSummary("Gửi mã OTP qua email cho đại diện Client để ký thỏa thuận")
        .Produces<SignatureChallengeResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status409Conflict);

        // 8. Client signs with OTP
        clientAgreements.MapPost("/sign", async (Guid jobId, Guid agreementId, [FromBody] SignRequestBody body, HttpContext httpContext, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            if (!user.IsInRole("CLIENT_COMPANY_USER")) return Forbidden();

            var command = new SignServiceAgreementCommand
            {
                JobId = jobId,
                AgreementId = agreementId,
                UserId = id.Value,
                ConcurrencyToken = body.ConcurrencyToken,
                Otp = body.Otp,
                ConsentAccepted = body.ConsentAccepted,
                ConsentTextVersion = body.ConsentTextVersion,
                ClientIp = httpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = httpContext.Request.Headers["User-Agent"].ToString()
            };

            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithName("SignServiceAgreement")
        .WithSummary("Client nhập mã OTP xác thực và hoàn tất ký điện tử thỏa thuận dịch vụ")
        .Produces<ServiceAgreementDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status409Conflict);

        // 9. Internal HR / Admin voids unsigned agreement
        internalAgreements.MapPost("/{agreementId:guid}/void", async (Guid jobId, Guid agreementId, [FromBody] VoidRequestBody body, ClaimsPrincipal user, ISender sender, CancellationToken ct) =>
        {
            var id = UserId(user);
            if (id == null) return Results.Unauthorized();
            if (!ReviewerCan(user, "job.review") && !ReviewerCan(user, "job.publish")) return Forbidden();

            var command = new VoidServiceAgreementCommand
            {
                JobId = jobId,
                AgreementId = agreementId,
                UserId = id.Value,
                VoidReason = body.VoidReason
            };

            return await Run(async () => Results.Ok(await sender.Send(command, ct)));
        })
        .WithName("VoidServiceAgreement")
        .WithSummary("Internal HR / Admin hủy bỏ thỏa thuận chưa ký")
        .Produces<ServiceAgreementDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict);

        return app;
    }

    public record RespondRequestBody(Guid ConcurrencyToken, string Action, string? ChangeRequestReason);
    public record SignRequestBody(Guid ConcurrencyToken, string Otp, bool ConsentAccepted, string? ConsentTextVersion);
    public record VoidRequestBody(string VoidReason);

    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
        catch (ForbiddenException ex) { return Results.Json(new { success = false, errorCode = ex.ErrorCode, message = ex.Message }, statusCode: 403); }
        catch (ConflictException ex)
        {
            return Results.Conflict(new
            {
                success = false,
                message = ex.Message,
                errorCode = ex.ErrorCode,
                data = ex.Details
            });
        }
        catch (DbUpdateConcurrencyException) { return Results.Conflict(new { success = false, message = "Thỏa thuận đã được thay đổi bởi người dùng khác. Hãy tải lại dữ liệu và thử lại." }); }
        catch (BadRequestException ex) { return Results.BadRequest(new { success = false, errorCode = ex.ErrorCode, message = ex.Message }); }
    }

    private static Guid? UserId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id) ? id : null;

    private static bool ReviewerCan(ClaimsPrincipal user, string permission) =>
        (user.IsInRole("INTERNAL_HR") || user.IsInRole("PLATFORM_ADMIN")) &&
        (user.HasClaim("permission", permission) || user.IsInRole("PLATFORM_ADMIN") || user.IsInRole("INTERNAL_HR"));

    private static IResult Forbidden() => Results.Json(new { success = false, message = "Bạn không có quyền thực hiện thao tác này." }, statusCode: 403);
}
