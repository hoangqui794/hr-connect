using HRConnect.Presentation.ErrorHandling;
using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Auth.Commands.ChangePassword;
using HRConnect.Application.Features.Auth.Commands.ForgotPassword;
using HRConnect.Application.Features.Auth.Commands.Login;
using HRConnect.Application.Features.Auth.Commands.Logout;
using HRConnect.Application.Features.Auth.Commands.LogoutAll;
using HRConnect.Application.Features.Auth.Commands.RefreshToken;
using HRConnect.Application.Features.Auth.Commands.RegisterAffiliate;
using HRConnect.Application.Features.Auth.Commands.RegisterCandidate;
using HRConnect.Application.Features.Auth.Commands.RegisterClient;
using HRConnect.Application.Features.Auth.Commands.SplitAccount;
using HRConnect.Application.Features.Auth.Commands.ResendPasswordResetOtp;
using HRConnect.Application.Features.Auth.Commands.ResendRegistrationOtp;
using HRConnect.Application.Features.Auth.Commands.ResetPassword;
using HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;
using HRConnect.Application.Features.Auth.Queries.GetCurrentUser;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth")
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
                return Results.Created($"/api/v1/auth/candidate/{result.Data?.UserId}", result);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new
                {
                    success = false,
                    code = ex.ErrorCode,
                    message = ex.Message,
                    details = ex.Details
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
        .RequireRateLimiting("auth-registration")
        .WithName("RegisterCandidate")
        .WithSummary("Đăng ký tài khoản Ứng viên (Candidate Registration)")
        .WithDescription("Đăng ký tài khoản ứng viên ở trạng thái PENDING và gửi OTP một lần. Nếu email đã đăng ký nhưng chưa xác thực, trả 409 với code EMAIL_PENDING_VERIFICATION để giao diện đưa người dùng về màn hình OTP; hệ thống chỉ gửi mã mới khi người dùng gọi API resend. Hồ sơ ứng viên hiện hữu chỉ được liên kết sau khi xác minh OTP của email khớp. Không nhận hồ sơ chỉ bằng số điện thoại; danh tính xung đột trả 409.")
        .Produces<RegisterCandidateResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status500InternalServerError);

        // 2. Đăng ký Affiliate
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
                return Results.Created($"/api/v1/auth/affiliate/{result.Data?.UserId}", result);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new
                {
                    success = false,
                    code = ex.ErrorCode,
                    message = ex.Message,
                    details = ex.Details
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
        .RequireRateLimiting("auth-registration")
        .WithName("RegisterAffiliate")
        .WithSummary("Đăng ký tài khoản Đối tác tuyển dụng (Affiliate)")
        .WithDescription("Đăng ký tài khoản đối tác tuyển dụng mới, gửi OTP một lần và giữ trạng thái PENDING chờ xác thực email. Nếu email đang chờ xác thực, trả 409 với code EMAIL_PENDING_VERIFICATION; chỉ API resend mới gửi mã mới. Chưa cấp quyền AFFILIATE.")
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
                return Results.Created($"/api/v1/auth/client/{result.Data?.UserId}", result);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new
                {
                    success = false,
                    code = ex.ErrorCode,
                    message = ex.Message,
                    details = ex.Details
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
        .RequireRateLimiting("auth-registration")
        .WithName("RegisterClient")
        .WithSummary("Đăng ký tài khoản Doanh nghiệp tuyển dụng (Client Company User)")
        .WithDescription("Đăng ký tài khoản đại diện doanh nghiệp và công ty mới, gửi OTP một lần và giữ trạng thái PENDING chờ xác thực email. Nếu email đang chờ xác thực, trả 409 với code EMAIL_PENDING_VERIFICATION; chỉ API resend mới gửi mã mới. Chưa cấp quyền CLIENT_COMPANY_USER.")
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
            catch (ConflictException ex)
            {
                return ConflictResponse.From(ex);
            }
        })
        .RequireRateLimiting("auth-sensitive")
        .WithName("VerifyEmailOtp")
        .WithSummary("Xác thực mã OTP gửi về Email để kích hoạt tài khoản / xác nhận đăng ký")
        .WithDescription("Nhập email và mã OTP 6 số. Candidate chỉ nhận hồ sơ khớp sau xác minh email và chuyển sang ACTIVE; hồ sơ xung đột/đã được nhận trả 409. Affiliate và Client chuyển sang PENDING_ADMIN_APPROVAL.")
        .Produces<VerifyEmailOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict);

        // 5. Đăng nhập hệ thống
        group.MapPost("/login", async (
            [FromBody] LoginCommand command,
            HttpContext httpContext,
            [FromServices] IHostEnvironment environment,
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
                if (result.Data is not null && !string.IsNullOrWhiteSpace(result.Data.RefreshToken))
                {
                    RefreshTokenCookie.Write(
                        httpContext.Response,
                        result.Data.RefreshToken,
                        result.Data.RefreshTokenExpiresAt,
                        environment);
                }
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
        .RequireRateLimiting("auth-login")
        .WithName("Login")
        .WithSummary("Đăng nhập hệ thống (Email + Mật khẩu)")
        .WithDescription("Xác thực người dùng, trả về JWT Access Token kèm Roles & Permissions. Chặn tài khoản chưa xác thực email hoặc chưa được Admin phê duyệt.")
        .Produces<LoginResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        // 6. Gửi lại mã OTP xác thực đăng ký
        group.MapPost("/verify-email-otp/resend", async (
            [FromBody] ResendRegistrationOtpCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<ResendRegistrationOtpCommand> validator,
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
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                return Results.Ok(await sender.Send(command, cancellationToken));
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .RequireRateLimiting("auth-sensitive")
        .WithName("ResendRegistrationOtp")
        .WithSummary("Gửi lại mã OTP xác thực đăng ký")
        .WithDescription("Chỉ cấp mã EMAIL_OTP mới khi người dùng chủ động gọi API này cho tài khoản còn PENDING và chưa xác thực email. Hệ thống không tự gửi lại mã. Mã cũ bị vô hiệu hóa; giới hạn một lần mỗi 60 giây.")
        .Produces<ResendRegistrationOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        // 7. Quên mật khẩu (Yêu cầu gửi OTP đặt lại mật khẩu)
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
        .RequireRateLimiting("auth-sensitive")
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
        .RequireRateLimiting("auth-sensitive")
        .WithName("ResendPasswordResetOtp")
        .WithSummary("Gửi lại mã OTP đặt lại mật khẩu mới")
        .WithDescription("Vô hiệu hóa mã OTP cũ và gửi mã OTP mới nếu tài khoản hợp lệ. Có cơ chế giới hạn tần suất (cooldown 60s).")
        .Produces<ResendPasswordResetOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        // 8. Đặt lại mật khẩu (Xác thực OTP và cập nhật mật khẩu mới)
        group.MapPost("/reset-password", async (
            [FromBody] ResetPasswordCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<ResetPasswordCommand> validator,
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
        .RequireRateLimiting("auth-sensitive")
        .WithName("ResetPassword")
        .WithSummary("Đặt lại mật khẩu với mã OTP")
        .WithDescription("Xác thực mã OTP 6 chữ số, cập nhật mật khẩu mới và thu hồi toàn bộ Refresh Tokens hiện hành.")
        .Produces<ResetPasswordResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        // 9. Đổi mật khẩu (Dành cho người dùng đã đăng nhập)
        group.MapPut("/change-password", async (
            [FromBody] ChangePasswordCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<ChangePasswordCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                return UnauthorizedResponse();
            }

            command.UserId = userId;

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
            catch (NotFoundException ex)
            {
                return Results.NotFound(new
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
        .RequireAuthorization()
        .WithName("ChangePassword")
        .WithSummary("Đổi mật khẩu tài khoản (Yêu cầu đăng nhập)")
        .WithDescription("Người dùng đã đăng nhập đổi mật khẩu bằng cách nhập mật khẩu hiện tại và mật khẩu mới.")
        .Produces<ChangePasswordResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound);

        // 10. Làm mới token (Refresh Token Rotation)
        group.MapPost("/refresh-token", async (
            HttpContext httpContext,
            [FromServices] IHostEnvironment environment,
            [FromServices] ISender sender,
            [FromServices] IValidator<RefreshTokenCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var refreshToken = RefreshTokenCookie.Read(httpContext.Request)
                ?? await ReadLegacyRefreshTokenAsync(httpContext.Request, environment, cancellationToken);

            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
                return Results.Json(new
                {
                    success = false,
                    message = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
                }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var command = new RefreshTokenCommand(refreshToken);
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

            try
            {
                var result = await sender.Send(command, cancellationToken);
                if (result.Data is not null && !string.IsNullOrWhiteSpace(result.Data.RefreshToken))
                {
                    RefreshTokenCookie.Write(
                        httpContext.Response,
                        result.Data.RefreshToken,
                        result.Data.RefreshTokenExpiresAt,
                        environment);
                }
                return Results.Ok(result);
            }
            catch (BadRequestException ex)
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
                return Results.BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (ForbiddenException ex)
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
                return Results.Json(new
                {
                    success = false,
                    message = ex.Message
                }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (UnauthorizedException ex)
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
                return Results.Json(new
                {
                    success = false,
                    message = ex.Message
                }, statusCode: StatusCodes.Status401Unauthorized);
            }
        })
        .AllowAnonymous()
        .WithName("RefreshToken")
        .WithSummary("Làm mới Access Token (Refresh Token Rotation)")
        .WithDescription("Dùng Refresh Token trong cookie HttpOnly để nhận Access Token mới. Refresh Token được xoay vòng trong cookie và token cũ bị vô hiệu hóa ngay.")
        .Produces<RefreshTokenResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status401Unauthorized);

        // 11. Đăng xuất (Thu hồi Refresh Token hiện tại)
        group.MapPost("/logout", async (
            HttpContext httpContext,
            ClaimsPrincipal user,
            [FromServices] IHostEnvironment environment,
            [FromServices] ISender sender,
            [FromServices] IValidator<LogoutCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
                return UnauthorizedResponse();
            }

            var refreshToken = RefreshTokenCookie.Read(httpContext.Request)
                ?? await ReadLegacyRefreshTokenAsync(httpContext.Request, environment, cancellationToken);
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
                return Results.Ok(new LogoutResponse());
            }

            var command = new LogoutCommand(refreshToken);
            command.UserId = userId;

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
            finally
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
            }
        })
        .RequireAuthorization()
        .WithName("Logout")
        .WithSummary("Đăng xuất tài khoản (Thu hồi phiên Refresh Token)")
        .WithDescription("Thu hồi Refresh Token trong cookie HttpOnly của phiên hiện tại và xóa cookie khỏi trình duyệt.")
        .Produces<LogoutResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized);

        // 12. Đăng xuất khỏi tất cả thiết bị (Thu hồi toàn bộ Refresh Token của người dùng)
        group.MapPost("/logout-all", async (
            HttpContext httpContext,
            ClaimsPrincipal user,
            [FromServices] IHostEnvironment environment,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
                return UnauthorizedResponse();
            }

            var command = new LogoutAllCommand { UserId = userId };

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
            finally
            {
                RefreshTokenCookie.Delete(httpContext.Response, environment);
            }
        })
        .RequireAuthorization()
        .WithName("LogoutAll")
        .WithSummary("Đăng xuất khỏi tất cả thiết bị (Thu hồi toàn bộ phiên Refresh Token)")
        .WithDescription("Người dùng đã đăng nhập yêu cầu thu hồi toàn bộ các Refresh Token đang hoạt động trên tất cả thiết bị.")
        .Produces<LogoutAllResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized);

        // 13. Lấy thông tin người dùng hiện tại (Get Current User / Auth Me)
        group.MapGet("/me", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                return UnauthorizedResponse();
            }

            try
            {
                var result = await sender.Send(new GetCurrentUserQuery(userId), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (UnauthorizedException)
            {
                return UnauthorizedResponse();
            }
        })
        .RequireAuthorization()
        .WithName("GetCurrentUser")
        .WithSummary("Lấy thông tin người dùng hiện tại (Auth Me)")
        .WithDescription("Trả về thông tin định danh, trạng thái tài khoản, vai trò và quyền hạn hiện tại từ cơ sở dữ liệu của người dùng đang đăng nhập.")
        .Produces<CurrentUserResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound);

        // Alias hỗ trợ cả /api/auth/me
        app.MapGet("/api/auth/me", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                return UnauthorizedResponse();
            }

            try
            {
                var result = await sender.Send(new GetCurrentUserQuery(userId), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (UnauthorizedException)
            {
                return UnauthorizedResponse();
            }
        })
        .RequireAuthorization()
        .WithTags("Auth")
        .WithName("GetCurrentUserLegacy")
        .ExcludeFromDescription();

        // 13. Yêu cầu mã OTP để tách email phụ thành tài khoản riêng
        group.MapPost("/request-split-otp", async (
            [FromBody] RequestSplitOtpCommand command,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("RequestSplitOtp")
        .WithSummary("Gửi mã OTP để tách email phụ thành tài khoản riêng")
        .Produces<RequestSplitOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        // 14. Xác thực OTP và hoàn tất tách tài khoản + đăng ký tài khoản mới
        group.MapPost("/confirm-split-register", async (
            [FromBody] ConfirmSplitRegisterCommand command,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
        })
        .WithName("ConfirmSplitRegister")
        .WithSummary("Xác thực OTP và tách email phụ thành tài khoản mới")
        .Produces<ConfirmSplitRegisterResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);

        return app;
    }

    private static IResult UnauthorizedResponse() => Results.Json(new
    {
        success = false,
        message = "Bạn chưa đăng nhập hoặc phiên đăng nhập không hợp lệ."
    }, statusCode: StatusCodes.Status401Unauthorized);

    private static async Task<string?> ReadLegacyRefreshTokenAsync(
        HttpRequest request,
        IHostEnvironment environment,
        CancellationToken cancellationToken)
    {
        if (environment.IsProduction() || request.ContentLength is not > 0)
        {
            return null;
        }

        try
        {
            var legacyRequest = await request.ReadFromJsonAsync<RefreshTokenCommand>(cancellationToken);
            return legacyRequest?.RefreshToken;
        }
        catch
        {
            return null;
        }
    }
}
