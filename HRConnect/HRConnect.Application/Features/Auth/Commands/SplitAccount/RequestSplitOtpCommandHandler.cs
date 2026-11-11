using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Auth.Commands.SplitAccount;

public class RequestSplitOtpCommandHandler : IRequestHandler<RequestSplitOtpCommand, RequestSplitOtpResponse>
{
    private readonly IUserEmailIdentityRepository _userEmailIdentityRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IOtpService _otpService;
    private readonly IEmailService _emailService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly AuthenticationSettings _authSettings;
    private readonly ILogger<RequestSplitOtpCommandHandler> _logger;

    public RequestSplitOtpCommandHandler(
        IUserEmailIdentityRepository userEmailIdentityRepository,
        IUserTokenRepository userTokenRepository,
        IEmailNormalizer emailNormalizer,
        IOtpService otpService,
        IEmailService emailService,
        IUnitOfWork unitOfWork,
        IOptions<AuthenticationSettings> authOptions,
        ILogger<RequestSplitOtpCommandHandler> logger)
    {
        _userEmailIdentityRepository = userEmailIdentityRepository;
        _userTokenRepository = userTokenRepository;
        _emailNormalizer = emailNormalizer;
        _otpService = otpService;
        _emailService = emailService;
        _unitOfWork = unitOfWork;
        _authSettings = authOptions.Value;
        _logger = logger;
    }

    public async Task<RequestSplitOtpResponse> Handle(RequestSplitOtpCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
            throw new BadRequestException("Email không hợp lệ.");

        var activeIdentity = await _userEmailIdentityRepository.GetActiveByNormalizedEmailAsync(normalizedEmail, cancellationToken);
        if (activeIdentity == null || string.Equals(activeIdentity.Kind, "PRIMARY", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Email này không phải là email phụ được liên kết để có thể tách tài khoản.");
        }

        var now = DateTime.UtcNow;
        await _userTokenRepository.InvalidateActiveTokensAsync(activeIdentity.UserId, "SPLIT_EMAIL_OTP", cancellationToken);

        var otpLength = _authSettings.Otp?.Length > 0 ? _authSettings.Otp.Length : 6;
        var expirationMinutes = _authSettings.Otp?.ExpirationMinutes > 0 ? _authSettings.Otp.ExpirationMinutes : 15;

        var rawOtp = _otpService.GenerateNumericOtp(otpLength);
        var tokenHash = _otpService.HashOtp(rawOtp);

        var userToken = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = activeIdentity.UserId,
            TokenType = "SPLIT_EMAIL_OTP",
            TokenHash = tokenHash,
            ExpiresAt = now.AddMinutes(expirationMinutes),
            AttemptCount = 0,
            CreatedAt = now
        };

        await _userTokenRepository.AddAsync(userToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var emailTemplate = HRConnect.Application.Common.Email.HrConnectEmailTemplates.SplitAccountOtp(
            request.Email.Trim(), rawOtp, expirationMinutes);

        await _emailService.SendEmailAsync(
            request.Email.Trim(),
            emailTemplate.Subject,
            emailTemplate.HtmlBody,
            cancellationToken);

        _logger.LogInformation("Đã gửi mã OTP tách tài khoản tới email {Email}", normalizedEmail);

        return new RequestSplitOtpResponse();
    }
}

