using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Auth.Commands.ForgotPassword;
using HRConnect.Application.Features.Auth.Commands.Login;
using HRConnect.Application.Features.Auth.Commands.RegisterAffiliate;
using HRConnect.Application.Features.Auth.Commands.RegisterCandidate;
using HRConnect.Application.Features.Auth.Commands.RegisterClient;
using HRConnect.Application.Features.Auth.Commands.ResendPasswordResetOtp;
using HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
                       .WithTags("Auth");

        // 1. Đăng ký Candidate
        group.MapPost("/register/candidate", async (
            [FromBody] RegisterCandidateCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<RegisterCandidateCommand> validator,
            CancellationToken cancellationToken) =>
        {
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

        // 2. Đăng ký Affiliate Recruiter
        group.MapPost("/register/affiliate", async (
            [FromBody] RegisterAffiliateCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<RegisterAffiliateCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu đăng ký Affiliate không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key, 
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/auth/affiliate/{result.Data?.UserId}", result);
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
        .WithName("RegisterAffiliate")
        .WithSummary("Đăng ký tài khoản Đối tác tuyển dụng (Affiliate Recruiter)")
        .WithDescription("Đăng ký tài khoản đối tác tuyển dụng mới. Trạng thái PENDING chờ xác thực email OTP. Chưa cấp quyền AFFILIATE_RECRUITER.")
        .Produces<RegisterAffiliateResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status500InternalServerError);

        // 3. Đăng ký Client Company User
        group.MapPost("/register/client", async (
            [FromBody] RegisterClientCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<RegisterClientCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu đăng ký Doanh nghiệp không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key, 
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/auth/client/{result.Data?.UserId}", result);
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
        .WithName("RegisterClient")
        .WithSummary("Đăng ký tài khoản Doanh nghiệp tuyển dụng (Client Company User)")
        .WithDescription("Đăng ký tài khoản đại diện doanh nghiệp và công ty mới. Trạng thái PENDING chờ xác thực email OTP. Chưa cấp quyền CLIENT_COMPANY_USER.")
        .Produces<RegisterClientResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status500InternalServerError);

        // 4. Xác thực mã OTP qua Email
        group.MapPost("/verify-email-otp", async (
            [FromBody] VerifyEmailOtpCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<VerifyEmailOtpCommand> validator,
            CancellationToken cancellationToken) =>
        {
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
        .WithSummary("Xác thực mã OTP gửi về Email để kích hoạt tài khoản / xác nhận đăng ký")
        .WithDescription("Nhập email và mã OTP 6 số. Candidate chuyển sang ACTIVE. Affiliate và Client chuyển sang PENDING_ADMIN_APPROVAL.")
        .Produces<VerifyEmailOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        // 5. Đăng nhập hệ thống
        group.MapPost("/login", async (
            [FromBody] LoginCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<LoginCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu đăng nhập không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key, 
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (UnauthorizedException ex)
            {
                return Results.Json(new
                {
                    success = false,
                    message = ex.Message
                }, statusCode: StatusCodes.Status401Unauthorized);
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new
                {
                    success = false,
                    message = ex.Message
                }, statusCode: StatusCodes.Status403Forbidden);
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
        .WithName("Login")
        .WithSummary("Đăng nhập hệ thống (Email + Mật khẩu)")
        .WithDescription("Xác thực người dùng, trả về JWT Access Token kèm Roles & Permissions. Chặn tài khoản chưa xác thực email hoặc chưa được Admin phê duyệt.")
        .Produces<LoginResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        // 6. Quên mật khẩu (Yêu cầu gửi OTP đặt lại mật khẩu)
        group.MapPost("/forgot-password", async (
            [FromBody] ForgotPasswordCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<ForgotPasswordCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu yêu cầu không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key, 
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            var result = await sender.Send(command, cancellationToken);
            return Results.Ok(result);
        })
        .WithName("ForgotPassword")
        .WithSummary("Yêu cầu gửi mã OTP đặt lại mật khẩu")
        .WithDescription("Nhận email và gửi mã xác thực đặt lại mật khẩu nếu email tồn tại trong hệ thống. Luôn trả về thông báo chung để chống lộ thông tin tài khoản.")
        .Produces<ForgotPasswordResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        // 7. Gửi lại mã OTP đặt lại mật khẩu
        group.MapPost("/forgot-password/resend", async (
            [FromBody] ResendPasswordResetOtpCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<ResendPasswordResetOtpCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu yêu cầu không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key, 
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            var result = await sender.Send(command, cancellationToken);
            return Results.Ok(result);
        })
        .WithName("ResendPasswordResetOtp")
        .WithSummary("Gửi lại mã OTP đặt lại mật khẩu mới")
        .WithDescription("Vô hiệu hóa mã OTP cũ và gửi mã OTP mới nếu tài khoản hợp lệ. Có cơ chế giới hạn tần suất (cooldown 60s).")
        .Produces<ResendPasswordResetOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        return app;
    }
}
