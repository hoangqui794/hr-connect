using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Auth.Commands.RegisterCandidate;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
                       .WithTags("Auth");

        group.MapPost("/register/candidate", async (
            [FromBody] RegisterCandidateCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<RegisterCandidateCommand> validator,
            CancellationToken cancellationToken) =>
        {
            // 1. Validate Command trực tiếp bằng FluentValidation
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu đăng ký không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key, 
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                // 2. Gửi Command vào MediatR Pipeline (Vertical Slice CQRS)
                var result = await sender.Send(command, cancellationToken);

                return Results.Created($"/api/auth/candidate/{result.Data?.UserId}", result);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        })
        .WithName("RegisterCandidate")
        .WithSummary("Đăng ký tài khoản Ứng viên (Candidate Registration)")
        .WithDescription("Đăng ký tài khoản ứng viên mới hoặc liên kết hồ sơ ứng viên hiện hữu. Trạng thái PENDING chờ xác thực email OTP.")
        .Produces<RegisterCandidateResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status500InternalServerError);

        group.MapPost("/verify-email-otp", async (
            [FromBody] HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp.VerifyEmailOtpCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp.VerifyEmailOtpCommand> validator,
            CancellationToken cancellationToken) =>
        {
            // 1. Validate Command bằng FluentValidation
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu xác thực không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key, 
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                // 2. Dispatch Command vào MediatR Pipeline
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        })
        .WithName("VerifyEmailOtp")
        .WithSummary("Xác thực mã OTP gửi về Email để kích hoạt tài khoản")
        .WithDescription("Nhập email và mã OTP 6 số. Khi xác thực thành công, tài khoản chuyển từ PENDING sang ACTIVE.")
        .Produces<HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp.VerifyEmailOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        return app;
    }
}
