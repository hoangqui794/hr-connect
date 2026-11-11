using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.SplitAccount;

public record RequestSplitOtpCommand(string Email) : IRequest<RequestSplitOtpResponse>;

public class RequestSplitOtpResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Mã xác thực tách tài khoản đã được gửi tới email của bạn.";
}

