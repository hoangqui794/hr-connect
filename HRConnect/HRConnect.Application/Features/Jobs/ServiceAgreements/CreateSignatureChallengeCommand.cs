using System;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class CreateSignatureChallengeCommand : IRequest<SignatureChallengeResponse>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid AgreementId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
}

public sealed class SignatureChallengeResponse
{
    public Guid ChallengeId { get; set; }
    public Guid ServiceAgreementId { get; set; }
    public string SignerEmail { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int CooldownSeconds { get; set; } = 60;
    public string Message { get; set; } = null!;
    public Guid ConcurrencyToken { get; set; }
    public string? DevOtp { get; set; }
}

public sealed class CreateSignatureChallengeCommandHandler : IRequestHandler<CreateSignatureChallengeCommand, SignatureChallengeResponse>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly ICompanyUserRepository _companyUsers;
    private readonly IUserRepository _users;
    private readonly IOtpService _otpService;
    private readonly IEmailService _emailService;
    private readonly IUnitOfWork _uow;

    public CreateSignatureChallengeCommandHandler(
        IServiceAgreementRepository agreements,
        ICompanyUserRepository companyUsers,
        IUserRepository users,
        IOtpService otpService,
        IEmailService emailService,
        IUnitOfWork uow)
    {
        _agreements = agreements;
        _companyUsers = companyUsers;
        _users = users;
        _otpService = otpService;
        _emailService = emailService;
        _uow = uow;
    }

    public async Task<SignatureChallengeResponse> Handle(CreateSignatureChallengeCommand request, CancellationToken ct)
    {
        var agreement = await _agreements.GetByIdForUpdateAsync(request.AgreementId, ct);
        if (agreement == null || agreement.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
        }

        if (!agreement.IsCurrent || (
            agreement.Status != ServiceAgreementStatuses.Accepted &&
            agreement.Status != ServiceAgreementStatuses.AwaitingSignature &&
            agreement.Status != ServiceAgreementStatuses.SentToClient))
        {
            throw new ConflictException($"Chỉ có thể tạo mã OTP ký thỏa thuận khi thỏa thuận ở trạng thái SENT_TO_CLIENT, ACCEPTED hoặc AWAITING_SIGNATURE (hiện tại: {agreement.Status}).");
        }

        if (agreement.Status == ServiceAgreementStatuses.SentToClient)
        {
            agreement.Status = ServiceAgreementStatuses.Accepted;
            agreement.RespondedAt = DateTime.UtcNow;
            agreement.ConcurrencyToken = Guid.NewGuid();
        }

        // Verify user is active and primary contact
        var companyUser = await _companyUsers.GetByUserIdAsync(request.UserId, ct);
        if (companyUser == null || companyUser.CompanyId != agreement.CompanyId || companyUser.Status != "ACTIVE")
        {
            throw new ForbiddenException("Bạn không phải thành viên hợp lệ của doanh nghiệp này.");
        }

        if (!companyUser.IsPrimaryContact)
        {
            throw new ForbiddenException("Chỉ người đại diện chính (Primary Contact) của doanh nghiệp mới có thẩm quyền ký thỏa thuận dịch vụ.");
        }

        var user = await _users.GetByIdAsync(request.UserId, ct);
        if (user == null || string.IsNullOrWhiteSpace(user.Email))
        {
            throw new BadRequestException("Tài khoản người dùng không có email hợp lệ để nhận mã OTP.");
        }

        var now = DateTime.UtcNow;

        // Check daily rate limit (max 5 per day)
        var todayUtc = now.Date;
        var countToday = await _agreements.GetChallengeCountTodayAsync(request.UserId, todayUtc, ct);
        if (countToday >= 5)
        {
            throw new BadRequestException("Bạn đã vượt quá giới hạn 5 lần gửi mã OTP ký hợp đồng trong ngày. Vui lòng thử lại vào ngày mai.");
        }

        // Check active challenge cooldown (60 seconds)
        var activeChallenge = await _agreements.GetActiveChallengeAsync(agreement.ServiceAgreementId, request.UserId, now, ct);
        if (activeChallenge != null)
        {
            var secondsSinceCreation = (now - activeChallenge.CreatedAt).TotalSeconds;
            if (secondsSinceCreation < 60)
            {
                var remaining = (int)Math.Ceiling(60 - secondsSinceCreation);
                throw new BadRequestException($"Vui lòng đợi {remaining} giây trước khi yêu cầu gửi lại mã OTP.");
            }

            // Revoke previous challenge
            activeChallenge.IsRevoked = true;
            activeChallenge.RevokedAt = now;
        }

        // Generate and hash OTP
        var rawOtp = _otpService.GenerateNumericOtp(6);
        var otpHash = _otpService.HashOtp(rawOtp);
        var expiresAt = now.AddMinutes(10);

        var challenge = new ServiceAgreementSignatureChallenge
        {
            ChallengeId = Guid.NewGuid(),
            ServiceAgreementId = agreement.ServiceAgreementId,
            SignerUserId = request.UserId,
            SignerEmailNormalized = user.Email.Trim().ToUpperInvariant(),
            OtpHash = otpHash,
            ExpiresAt = expiresAt,
            AttemptCount = 0,
            MaxAttempts = 5,
            IsConsumed = false,
            IsRevoked = false,
            CreatedAt = now
        };

        await _agreements.AddChallengeAsync(challenge, ct);

        agreement.Status = ServiceAgreementStatuses.AwaitingSignature;
        agreement.ConcurrencyToken = Guid.NewGuid();

        // Send OTP email
        var emailSubject = $"[HR Connect] Mã OTP xác nhận ký thỏa thuận dịch vụ: {rawOtp}";
        var emailBody = $@"
<div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <h2 style='color: #0369A1;'>Xác nhận Ký Điện Tử Thỏa Thuận Dịch Vụ</h2>
    <p>Xin chào <strong>{user.DisplayName}</strong>,</p>
    <p>Bạn đang thực hiện thao tác ký điện tử Thỏa thuận cung cấp dịch vụ tuyển dụng cho doanh nghiệp <strong>{agreement.CompanyNameSnapshot}</strong> trên nền tảng HR Connect.</p>
    <div style='background-color: #F0F9FF; border: 1px solid #BAE6FD; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;'>
        <p style='margin: 0; font-size: 14px; color: #0284C7;'>MÃ XÁC THỰC OTP CỦA BẠN LÀ:</p>
        <h1 style='margin: 10px 0; font-size: 32px; letter-spacing: 6px; color: #0F172A;'>{rawOtp}</h1>
        <p style='margin: 0; font-size: 12px; color: #64748B;'>Mã có hiệu lực trong vòng 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
    </div>
    <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ với bộ phận hỗ trợ của HR Connect.</p>
    <hr style='border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;' />
    <p style='font-size: 12px; color: #94A3B8;'>Hệ thống tuyển dụng thông minh HR Connect.</p>
</div>";

        var emailResult = await _emailService.SendEmailAsync(user.Email, emailSubject, emailBody, ct);
        await _uow.SaveChangesAsync(ct);

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("================================================================================");
        Console.WriteLine($"[OTP KÝ THỎA THUẬN] User: {user.Email} | OTP: {rawOtp}");
        if (!emailResult.IsSuccess)
        {
            Console.WriteLine($"[LƯU Ý EMAIL] Gửi mail qua Resend thất bại: {emailResult.ErrorMessage}");
        }
        Console.WriteLine("================================================================================");
        Console.ResetColor();

        var message = emailResult.IsSuccess
            ? $"Mã OTP đã được gửi đến email {user.Email}. Mã có hiệu lực trong 10 phút."
            : $"Mã OTP ký thỏa thuận là: {rawOtp} (Lưu ý: Không gửi được email qua Resend do key chưa hợp lệ, mã được cung cấp trực tiếp để kiểm thử).";

        return new SignatureChallengeResponse
        {
            ChallengeId = challenge.ChallengeId,
            ServiceAgreementId = agreement.ServiceAgreementId,
            SignerEmail = user.Email,
            ExpiresAt = expiresAt,
            CooldownSeconds = 60,
            Message = message,
            ConcurrencyToken = agreement.ConcurrencyToken,
            DevOtp = rawOtp
        };
    }
}
