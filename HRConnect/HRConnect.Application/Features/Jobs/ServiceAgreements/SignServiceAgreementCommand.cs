using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class SignServiceAgreementCommand : IRequest<ServiceAgreementDto>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid AgreementId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    [JsonIgnore] public string? ClientIp { get; set; }
    [JsonIgnore] public string? UserAgent { get; set; }

    public Guid ConcurrencyToken { get; set; }
    public string Otp { get; set; } = null!;
    public bool ConsentAccepted { get; set; }
    public string? ConsentTextVersion { get; set; }
}

public sealed class SignServiceAgreementCommandHandler : IRequestHandler<SignServiceAgreementCommand, ServiceAgreementDto>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _companyUsers;
    private readonly IUserRepository _users;
    private readonly IOtpService _otpService;
    private readonly IAgreementPdfRenderer _pdfRenderer;
    private readonly IFileStorageService _storage;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly ISourcingFinanceService? _sourcingFinance;
    private readonly IUnitOfWork _uow;

    public SignServiceAgreementCommandHandler(
        IServiceAgreementRepository agreements,
        IJobRepository jobs,
        ICompanyUserRepository companyUsers,
        IUserRepository users,
        IOtpService otpService,
        IAgreementPdfRenderer pdfRenderer,
        IFileStorageService storage,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork uow,
        ISourcingFinanceService? sourcingFinance = null)
    {
        _agreements = agreements;
        _jobs = jobs;
        _companyUsers = companyUsers;
        _users = users;
        _otpService = otpService;
        _pdfRenderer = pdfRenderer;
        _storage = storage;
        _notifications = notifications;
        _audit = audit;
        _uow = uow;
        _sourcingFinance = sourcingFinance;
    }

    public async Task<ServiceAgreementDto> Handle(SignServiceAgreementCommand request, CancellationToken ct)
    {
        if (!request.ConsentAccepted)
        {
            throw new BadRequestException("Bắt buộc phải tích chọn đồng ý với các điều khoản của Thỏa thuận dịch vụ trước khi ký.");
        }

        if (string.IsNullOrWhiteSpace(request.Otp))
        {
            throw new BadRequestException("Vui lòng nhập mã OTP xác thực.");
        }

        var agreement = await _agreements.GetByIdForUpdateAsync(request.AgreementId, ct);
        if (agreement == null || agreement.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
        }

        if (agreement.ConcurrencyToken != request.ConcurrencyToken)
        {
            throw new ConflictException("Thỏa thuận dịch vụ đã được cập nhật bởi một thao tác khác. Vui lòng tải lại trang.");
        }

        if (agreement.Status == ServiceAgreementStatuses.Signed)
        {
            // Idempotent success if already signed
            return ServiceAgreementDto.FromEntity(agreement);
        }

        if (!agreement.IsCurrent || (agreement.Status != ServiceAgreementStatuses.Accepted && agreement.Status != ServiceAgreementStatuses.AwaitingSignature))
        {
            throw new ConflictException($"Không thể ký thỏa thuận dịch vụ khi đang ở trạng thái {agreement.Status}.");
        }

        // Validate user is active primary contact of company
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
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin tài khoản người ký.");
        }

        var now = DateTime.UtcNow;

        // Verify OTP challenge
        var challenge = await _agreements.GetActiveChallengeAsync(agreement.ServiceAgreementId, request.UserId, now, ct);
        if (challenge == null)
        {
            throw new BadRequestException("Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng bấm 'Gửi lại mã OTP'.");
        }

        if (challenge.AttemptCount >= challenge.MaxAttempts)
        {
            challenge.IsRevoked = true;
            challenge.RevokedAt = now;
            await _uow.SaveChangesAsync(ct);
            throw new BadRequestException("Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu gửi lại mã OTP mới.");
        }

        var isValidOtp = _otpService.VerifyOtp(request.Otp.Trim(), challenge.OtpHash);
        if (!isValidOtp)
        {
            challenge.AttemptCount++;
            if (challenge.AttemptCount >= challenge.MaxAttempts)
            {
                challenge.IsRevoked = true;
                challenge.RevokedAt = now;
            }
            await _uow.SaveChangesAsync(ct);
            var remaining = challenge.MaxAttempts - challenge.AttemptCount;
            throw new BadRequestException($"Mã OTP không chính xác. Bạn còn {remaining} lần thử.");
        }

        // Mark challenge consumed
        challenge.IsConsumed = true;
        challenge.ConsumedAt = now;

        // Fetch job for term copying and transition
        var job = await _jobs.GetByIdAsync(agreement.JobId, ct);
        if (job == null)
        {
            throw new NotFoundException("Không tìm thấy tin tuyển dụng liên quan.");
        }

        // Seal signature evidence into agreement
        agreement.Status = ServiceAgreementStatuses.Signed;
        agreement.SignerUserId = request.UserId;
        agreement.SignerNameSnapshot = user.DisplayName;
        agreement.SignerEmailSnapshot = user.Email;
        agreement.SignerRoleSnapshot = companyUser.RoleInCompany;
        agreement.ConsentTextVersion = request.ConsentTextVersion ?? "1.0";
        agreement.ConsentAcceptedAt = now;
        agreement.SignedAt = now;
        agreement.ConcurrencyToken = Guid.NewGuid();

        if (!string.IsNullOrWhiteSpace(request.ClientIp))
        {
            agreement.SignerIpHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.ClientIp))).ToLowerInvariant();
        }
        if (!string.IsNullOrWhiteSpace(request.UserAgent))
        {
            agreement.SignerUserAgentSummary = request.UserAgent.Length > 250 ? request.UserAgent[..250] : request.UserAgent;
        }

        // Render and store signed immutable PDF
        var signedPdfBytes = _pdfRenderer.RenderAgreementPdf(agreement, job, job.Company, isSigned: true);
        agreement.DocumentSha256Hash = Convert.ToHexString(SHA256.HashData(signedPdfBytes)).ToLowerInvariant();

        try
        {
            var signedObjectKey = $"companies/{job.CompanyId}/service-agreements/{agreement.ServiceAgreementId}/v{agreement.Version}/signed.pdf";
            using var stream = new MemoryStream(signedPdfBytes);
            await _storage.UploadAsync(stream, signedObjectKey, "application/pdf", ct);
            agreement.SignedDocumentStorageKey = signedObjectKey;
        }
        catch (Exception)
        {
            // Logging can happen in caller/interceptor
        }

        // Copy official terms from agreement onto Job
        job.FeeMultiplier = agreement.FeeMultiplier;
        job.WarrantyDays = agreement.WarrantyDays;
        job.PaymentDueDays = agreement.PaymentDueDays;
        job.SourcingTarget = agreement.SourcingTarget;
        job.SourcingPricePerCv = agreement.PricePerQualifiedCv;
        job.ReviewDays = agreement.ReviewDays;
        job.AgreementReference = agreement.VerificationCode;
        job.AgreementNote = agreement.AgreementNote;
        job.AgreedAt = now;
        job.AgreedBy = request.UserId;
        job.CurrentServiceAgreementId = agreement.ServiceAgreementId;
        job.UpdatedAt = now;
        job.ConcurrencyToken = Guid.NewGuid();

        // Perform job activation / transition
        var serviceTypeCode = agreement.ServiceTypeCode ?? job.ServiceType?.Code ?? await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, ct);

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            // HEADHUNT_COD goes straight to ACTIVE
            JobTransitions.ChangeStatus(
                job,
                JobStatuses.Active,
                request.UserId,
                JobReasonCodes.AgreementSigned,
                "Thỏa thuận dịch vụ Headhunt đã được ký kết thành công. Tin tuyển dụng đã được kích hoạt.");
            job.PostedAt = now;
        }
        else if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            // CV_SOURCING creates deposit and goes to PENDING_PAYMENT
            if (_sourcingFinance != null)
            {
                await _sourcingFinance.EnsureDepositAsync(job, request.UserId, ct, serviceTypeCode);
            }

            JobTransitions.ChangeStatus(
                job,
                JobStatuses.PendingPayment,
                request.UserId,
                JobReasonCodes.AgreementSigned,
                "Thỏa thuận dịch vụ Sourcing đã được ký kết thành công. Tin tuyển dụng đang chờ thanh toán tiền cọc để kích hoạt.");
        }

        // Send notifications
        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = agreement.CreatedByUserId,
            Title = "Thỏa thuận dịch vụ đã được ký",
            Message = $"Đại diện doanh nghiệp '{agreement.CompanyNameSnapshot}' đã ký điện tử thành công thỏa thuận dịch vụ (v{agreement.Version}) cho tin tuyển dụng '{job.Title}'.",
            NotificationType = "JOB",
            RelatedEntityType = "SERVICE_AGREEMENT",
            RelatedEntityId = agreement.ServiceAgreementId,
            Metadata = System.Text.Json.JsonSerializer.Serialize(new { agreementId = agreement.ServiceAgreementId, jobId = job.JobId }),
            CreatedAt = now
        }, ct);

        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = request.UserId,
            Title = "Ký thỏa thuận dịch vụ thành công",
            Message = $"Bạn đã ký điện tử thành công thỏa thuận dịch vụ cho vị trí '{job.Title}'. Mã tra cứu: {agreement.VerificationCode}.",
            NotificationType = "JOB",
            RelatedEntityType = "SERVICE_AGREEMENT",
            RelatedEntityId = agreement.ServiceAgreementId,
            Metadata = System.Text.Json.JsonSerializer.Serialize(new { agreementId = agreement.ServiceAgreementId, verificationCode = agreement.VerificationCode }),
            CreatedAt = now
        }, ct);

        await _audit.AddAsync(new AuditEntry
        {
            Action = "SERVICE_AGREEMENT_SIGNED",
            EntityType = "ServiceAgreement",
            EntityId = agreement.ServiceAgreementId,
            ActorUserId = request.UserId,
            NewValues = new { JobId = job.JobId, Version = agreement.Version, SignerEmail = user.Email }
        }, ct);

        await _uow.SaveChangesAsync(ct);

        return ServiceAgreementDto.FromEntity(agreement);
    }
}
