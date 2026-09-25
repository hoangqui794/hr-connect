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
using HRConnect.Application.Features.Auth.Commands.ResendPasswordResetOtp;
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
        .WithDescription("Đăng ký tài khoản ứng viên ở trạng thái PENDING. Hồ sơ ứng viên hiện hữu chỉ được liên kết sau khi xác minh OTP của email khớp. Không nhận hồ sơ chỉ bằng số điện thoại; danh tính xung đột trả 409.")
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
                return Results.Created($"/api/v1/auth/affiliate/{result.Data?.UserId}", result);
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
                return Results.Created($"/api/v1/auth/client/{result.Data?.UserId}", result);
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
        })
        .WithName("VerifyEmailOtp")
        .WithSummary("Xác thực mã OTP gửi về Email để kích hoạt tài khoản / xác nhận đăng ký")
        .WithDescription("Nhập email và mã OTP 6 số. Candidate chỉ nhận hồ sơ khớp sau xác minh email và chuyển sang ACTIVE; hồ sơ xung đột/đã được nhận trả 409. Affiliate và Client chuyển sang PENDING_ADMIN_APPROVAL.")
        .Produces<VerifyEmailOtpResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status409Conflict);

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
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

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
                return Results.Unauthorized();
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
            [FromBody] RefreshTokenCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<RefreshTokenCommand> validator,
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
            catch (ForbiddenException ex)
            {
                return Results.Json(new
                {
                    success = false,
                    message = ex.Message
                }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (UnauthorizedException ex)
            {
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
        .WithDescription("Gửi Refresh Token hợp lệ để nhận cặp Access Token mới và Refresh Token mới. Token cũ sẽ bị vô hiệu hóa ngay sau khi xoay vòng thành công.")
        .Produces<RefreshTokenResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status401Unauthorized);

        // 11. Đăng xuất (Thu hồi Refresh Token hiện tại)
        group.MapPost("/logout", async (
            [FromBody] LogoutCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<LogoutCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                return Results.Unauthorized();
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
        })
        .RequireAuthorization()
        .WithName("Logout")
        .WithSummary("Đăng xuất tài khoản (Thu hồi phiên Refresh Token)")
        .WithDescription("Người dùng đã đăng nhập gửi Refresh Token để thu hồi phiên làm việc hiện tại trên hệ thống.")
        .Produces<LogoutResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized);

        // 12. Đăng xuất khỏi tất cả thiết bị (Thu hồi toàn bộ Refresh Token của người dùng)
        group.MapPost("/logout-all", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(userIdString) || !Guid.TryParse(userIdString, out var userId))
            {
                return Results.Unauthorized();
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
                return Results.Unauthorized();
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
                return Results.Unauthorized();
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
                return Results.Unauthorized();
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
                return Results.Unauthorized();
            }
        })
        .RequireAuthorization()
        .WithTags("Auth")
        .WithName("GetCurrentUserLegacy")
        .ExcludeFromDescription();

        return app;
    }
}
