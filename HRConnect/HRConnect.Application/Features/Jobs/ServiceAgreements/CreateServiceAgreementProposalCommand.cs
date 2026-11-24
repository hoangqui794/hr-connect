using System;
using System.IO;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class CreateServiceAgreementProposalCommand : IRequest<ServiceAgreementDto>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public Guid ConcurrencyToken { get; set; }

    public decimal? FeeMultiplier { get; set; }
    public int? WarrantyDays { get; set; }
    public int? PaymentDueDays { get; set; }
    public decimal? PricePerQualifiedCv { get; set; }
    public int? SourcingTarget { get; set; }
    public int? ReviewDays { get; set; }
    public decimal? DepositPercent { get; set; }
    public string? AgreementReference { get; set; }
    public string? AgreementNote { get; set; }
}

public sealed class CreateServiceAgreementProposalCommandHandler : IRequestHandler<CreateServiceAgreementProposalCommand, ServiceAgreementDto>
{
    private readonly IJobRepository _jobs;
    private readonly IServiceAgreementRepository _agreements;
    private readonly IAgreementPdfRenderer _pdfRenderer;
    private readonly IFileStorageService _storage;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _uow;
    private readonly IAdminBusinessSettings? _adminSettings;
    private readonly IAppNotifier? _notifier;

    public CreateServiceAgreementProposalCommandHandler(
        IJobRepository jobs,
        IServiceAgreementRepository agreements,
        IAgreementPdfRenderer pdfRenderer,
        IFileStorageService storage,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork uow,
        IAdminBusinessSettings? adminSettings = null,
        IAppNotifier? notifier = null)
    {
        _jobs = jobs;
        _agreements = agreements;
        _pdfRenderer = pdfRenderer;
        _storage = storage;
        _notifications = notifications;
        _audit = audit;
        _uow = uow;
        _adminSettings = adminSettings;
        _notifier = notifier;
    }

    public async Task<ServiceAgreementDto> Handle(CreateServiceAgreementProposalCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);

        if (job.Status != JobStatuses.PendingReview && job.Status != JobStatuses.PendingAgreement)
        {
            throw new ConflictException($"Không thể tạo đề xuất thỏa thuận dịch vụ khi tin tuyển dụng đang ở trạng thái {job.Status}.");
        }

        var serviceTypeCode = job.ServiceType?.Code ?? await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, ct) ?? string.Empty;
        if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvApplication, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Dịch vụ CV_APPLICATION sử dụng gói đăng tin công khai, không áp dụng quy trình thỏa thuận đàm phán riêng.");
        }

        decimal? resolvedMultiplier = null;
        int? resolvedWarranty = null;
        int? resolvedPaymentDue = null;
        decimal? resolvedPrice = null;
        int? resolvedTarget = null;
        int? resolvedReview = null;

        // Validate ranges based on service type
        if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            var defaultMultiplier = _adminSettings != null
                ? await _adminSettings.GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier, ct)
                : 1.5m;
            var defaultWarranty = _adminSettings != null
                ? await _adminSettings.GetIntAsync(BusinessSettingKeys.HeadhuntWarrantyDays, ct)
                : 30;
            var defaultPaymentDue = _adminSettings != null
                ? await _adminSettings.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, ct)
                : 20;

            var multiplier = request.FeeMultiplier ?? job.ProposedFeeMultiplier ?? defaultMultiplier;
            var warranty = request.WarrantyDays ?? job.ProposedWarrantyDays ?? defaultWarranty;
            var paymentDue = request.PaymentDueDays ?? job.ProposedPaymentDueDays ?? defaultPaymentDue;

            if (multiplier < 0.1m || multiplier > 10.0m)
                throw new BadRequestException($"Hệ số phí Headhunt không hợp lệ ({multiplier}). Khoảng cho phép: 0.1 - 10.0.");
            if (warranty < 1 || warranty > 365)
                throw new BadRequestException($"Số ngày bảo hành không hợp lệ ({warranty}). Khoảng cho phép: 1 - 365 ngày.");
            if (paymentDue < 1 || paymentDue > 120)
                throw new BadRequestException($"Hạn thanh toán không hợp lệ ({paymentDue}). Khoảng cho phép: 1 - 120 ngày.");

            resolvedMultiplier = multiplier;
            resolvedWarranty = warranty;
            resolvedPaymentDue = paymentDue;
        }
        else if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            var defaultPrice = _adminSettings != null
                ? await _adminSettings.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, ct)
                : 600_000m;
            var defaultReview = _adminSettings != null
                ? await _adminSettings.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, ct)
                : 7;
            var defaultPaymentDue = _adminSettings != null
                ? await _adminSettings.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, ct)
                : 20;

            var target = request.SourcingTarget ?? job.SourcingTarget ?? 10;
            var price = request.PricePerQualifiedCv ?? job.ProposedPricePerCv ?? defaultPrice;
            var review = request.ReviewDays ?? job.ReviewDays ?? defaultReview;
            var paymentDue = request.PaymentDueDays ?? job.ProposedPaymentDueDays ?? defaultPaymentDue;

            if (target < 1)
                throw new BadRequestException("Số lượng CV mục tiêu (Sourcing Target) phải lớn hơn hoặc bằng 1.");
            if (price < 1_000m || price > 100_000_000m)
                throw new BadRequestException($"Đơn giá CV không hợp lệ ({price:N0}). Khoảng cho phép: 1.000 - 100.000.000 VNĐ.");
            if (review < 1 || review > 30)
                throw new BadRequestException($"Thời gian xem xét hồ sơ không hợp lệ ({review}). Khoảng cho phép: 1 - 30 ngày.");
            if (paymentDue < 1 || paymentDue > 120)
                throw new BadRequestException($"Hạn thanh toán không hợp lệ ({paymentDue}). Khoảng cho phép: 1 - 120 ngày.");

            resolvedTarget = target;
            resolvedPrice = price;
            resolvedReview = review;
            resolvedPaymentDue = paymentDue;

            if (request.DepositPercent.HasValue)
            {
                var depositBounds = BusinessSettingKeys.Get(BusinessSettingKeys.CvSourcingDepositPercent);

                if (request.DepositPercent.Value < depositBounds.Min || request.DepositPercent.Value > depositBounds.Max)
                {
                    throw new BadRequestException(
                        $"Tỷ lệ đặt cọc không hợp lệ ({request.DepositPercent.Value:G29}%). Khoảng cho phép: {depositBounds.Min:G29}% - {depositBounds.Max:G29}%.",
                        "TERM_OUT_OF_RANGE");
                }

                job.DepositPercent = request.DepositPercent.Value;
            }
            else if (job.DepositPercent is not > 0m)
            {
                if (_adminSettings == null)
                {
                    throw new ConflictException(
                        "Chưa có cấu hình tỷ lệ đặt cọc mặc định cho dịch vụ CV Sourcing.",
                        "SOURCING_DEPOSIT_TERMS_MISSING");
                }

                job.DepositPercent = await _adminSettings.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, ct);
            }
        }

        var now = DateTime.UtcNow;
        var history = await _agreements.GetHistoryByJobIdAsync(job.JobId, ct);
        var nextVersion = history.Count > 0 ? history.Max(a => a.Version) + 1 : 1;

        // De-current previous agreements
        foreach (var pastAgreement in history.Where(a => a.IsCurrent))
        {
            pastAgreement.IsCurrent = false;
        }

        var agreementId = Guid.NewGuid();
        var verificationCode = !string.IsNullOrWhiteSpace(request.AgreementReference)
            ? request.AgreementReference.Trim()
            : ("HRC-" + Guid.NewGuid().ToString("N")[..10].ToUpperInvariant());

        var existingWithCode = await _agreements.GetByVerificationCodeAsync(verificationCode, ct);
        if (existingWithCode != null)
        {
            verificationCode = $"{verificationCode}-V{nextVersion}";
            if (await _agreements.GetByVerificationCodeAsync(verificationCode, ct) != null)
            {
                verificationCode = "HRC-" + Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();
            }
        }

        job.AgreementReference = verificationCode;

        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = job.CompanyId,
            Version = nextVersion,
            ServiceTypeCode = serviceTypeCode,
            Status = ServiceAgreementStatuses.SentToClient,
            ConcurrencyToken = Guid.NewGuid(),
            IsCurrent = true,
            FeeMultiplier = resolvedMultiplier,
            WarrantyDays = resolvedWarranty,
            PaymentDueDays = resolvedPaymentDue,
            PricePerQualifiedCv = resolvedPrice,
            SourcingTarget = resolvedTarget,
            ReviewDays = resolvedReview,
            AgreementNote = string.IsNullOrWhiteSpace(request.AgreementNote) ? null : request.AgreementNote.Trim(),
            CompanyNameSnapshot = job.Company.CompanyName,
            CompanyTaxCodeSnapshot = job.Company.TaxCode,
            CompanyAddressSnapshot = job.Company.Address,
            HrConnectLegalEntitySnapshot = "CÔNG TY CỔ PHẦN CÔNG NGHỆ NHÂN SỰ HR CONNECT",
            VerificationCode = verificationCode,
            CreatedByUserId = request.UserId,
            CreatedAt = now,
            SentToClientAt = now,
            Job = job
        };

        // Render unsigned PDF and store in R2
        try
        {
            var pdfBytes = _pdfRenderer.RenderAgreementPdf(agreement, job, job.Company, isSigned: false);
            var objectKey = $"companies/{job.CompanyId}/service-agreements/{agreementId}/v{nextVersion}/unsigned.pdf";
            using var stream = new MemoryStream(pdfBytes);
            await _storage.UploadAsync(stream, objectKey, "application/pdf", ct);
            agreement.UnsignedDocumentStorageKey = objectKey;
        }
        catch (Exception)
        {
            // If storage fails, we still allow agreement creation, storage key will remain null until retry
        }

        await _agreements.AddAsync(agreement, ct);

        // Update Job current agreement and transition status if in PENDING_REVIEW
        job.CurrentServiceAgreementId = agreementId;
        job.UpdatedAt = now;
        job.ConcurrencyToken = Guid.NewGuid();

        if (job.Status == JobStatuses.PendingReview || job.Status == JobStatuses.PendingAgreement)
        {
            var statusReason = job.Status == JobStatuses.PendingAgreement
                ? $"HR đã gửi lại dự thảo thỏa thuận dịch vụ (v{nextVersion}) cho Client xem xét."
                : $"HR đã gửi dự thảo thỏa thuận dịch vụ (v{nextVersion}) cho Client xem xét.";

            JobTransitions.ChangeStatus(
                job,
                JobStatuses.PendingAgreement,
                request.UserId,
                JobReasonCodes.AgreementProposed,
                statusReason);
        }

        // Notify Client Company & HR
        if (_notifier != null)
        {
            await _notifier.NotifyCompanyAsync(job.CompanyId, new AppNotice(
                "JOB",
                "Đề xuất thỏa thuận dịch vụ mới",
                $"HR Connect đã gửi dự thảo thỏa thuận dịch vụ (v{nextVersion}) cho tin tuyển dụng '{job.Title}'. Vui lòng xem xét và phản hồi.",
                "SERVICE_AGREEMENT",
                agreementId,
                $"/client/agreements?jobId={job.JobId}"
            ), ct);

            await _notifier.NotifyRoleAsync("INTERNAL_HR", new AppNotice(
                "JOB",
                "Đã gửi đề xuất thỏa thuận dịch vụ",
                $"Dự thảo thỏa thuận (v{nextVersion}) cho tin \"{job.Title}\" đã được gửi tới Client.",
                "SERVICE_AGREEMENT",
                agreementId,
                $"/hr/jobs?status=PENDING_AGREEMENT&highlight={job.JobId}"
            ), ct);
        }
        else
        {
            var notification = new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = job.CreatedBy,
                Title = "Đề xuất thỏa thuận dịch vụ mới",
                Message = $"HR Connect đã gửi dự thảo thỏa thuận dịch vụ (v{nextVersion}) cho tin tuyển dụng '{job.Title}'. Vui lòng xem xét và phản hồi.",
                NotificationType = "JOB",
                RelatedEntityType = "SERVICE_AGREEMENT",
                RelatedEntityId = agreementId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new { jobId = job.JobId, agreementId, version = nextVersion }),
                CreatedAt = now
            };
            await _notifications.AddAsync(notification, ct);
        }

        await _audit.AddAsync(new AuditEntry
        {
            Action = "SERVICE_AGREEMENT_PROPOSED",
            EntityType = "ServiceAgreement",
            EntityId = agreementId,
            ActorUserId = request.UserId,
            NewValues = new { JobId = job.JobId, Version = nextVersion }
        }, ct);

        await _uow.SaveChangesAsync(ct);

        return ServiceAgreementDto.FromEntity(agreement);
    }
}
