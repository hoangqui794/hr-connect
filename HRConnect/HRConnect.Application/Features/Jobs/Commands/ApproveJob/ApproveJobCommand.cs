using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.ApproveJob;

public sealed class ApproveJobCommand : IRequest<JobActionResponse>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public Guid ConcurrencyToken { get; set; }
    public CommercialTermsApprovalRequest? CommercialTerms { get; set; }
    public string? AgreementReference { get; set; }
    public string? Note { get; set; }
    public string? PaymentReference { get; set; }
}

public sealed class ApproveJobCommandHandler : IRequestHandler<ApproveJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly IAdminBusinessSettings _adminSettings;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _auditLogService;
    private readonly IUnitOfWork _uow;
    private readonly ISourcingFinanceService? _sourcingFinance;

    public ApproveJobCommandHandler(
        IJobRepository jobs,
        IAdminBusinessSettings adminSettings,
        INotificationRepository notifications,
        IAuditLogService auditLogService,
        IUnitOfWork uow,
        ISourcingFinanceService? sourcingFinance = null)
    {
        _jobs = jobs;
        _adminSettings = adminSettings;
        _notifications = notifications;
        _auditLogService = auditLogService;
        _uow = uow;
        _sourcingFinance = sourcingFinance;
    }

    public async Task<JobActionResponse> Handle(ApproveJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);
        JobHandlerGuards.RequireStatus(job, JobStatuses.PendingReview);

        var serviceTypeCode = job.ServiceType?.Code ?? await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, ct);
        var now = DateTime.UtcNow;
        var requiresPayment = false;
        decimal standardPrice = 0m;
        // CV_SOURCING: the job opens only after the Client pays the deposit (decision 2026-10-17).
        var awaitsSourcingDeposit = false;

        object? adminDefaultsAtApproval = null;
        object? approvedTerms = null;
        var proposedTerms = new
        {
            feeMultiplier = job.ProposedFeeMultiplier,
            warrantyDays = job.ProposedWarrantyDays,
            paymentDueDays = job.ProposedPaymentDueDays,
            pricePerCv = job.ProposedPricePerCv,
            sourcingTarget = job.SourcingTarget,
            note = job.ProposedFeeNote
        };

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            if (request.CommercialTerms != null)
            {
                if (request.CommercialTerms.SourcingTarget.HasValue ||
                    request.CommercialTerms.PricePerCv.HasValue ||
                    request.CommercialTerms.DepositPercent.HasValue ||
                    request.CommercialTerms.ReviewDays.HasValue)
                {
                    throw new BadRequestException("Điều khoản thương mại gửi lên không áp dụng cho dịch vụ HEADHUNT_COD.", "TERM_NOT_APPLICABLE");
                }
            }

            var defaultFeeMultiplier = await _adminSettings.GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier, ct);
            var defaultWarrantyDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.HeadhuntWarrantyDays, ct);
            var defaultPaymentDueDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, ct);

            adminDefaultsAtApproval = new
            {
                feeMultiplier = defaultFeeMultiplier,
                warrantyDays = defaultWarrantyDays,
                paymentDueDays = defaultPaymentDueDays
            };

            var feeMultiplier = request.CommercialTerms?.FeeMultiplier ?? job.ProposedFeeMultiplier ?? defaultFeeMultiplier;
            var warrantyDays = request.CommercialTerms?.WarrantyDays ?? job.ProposedWarrantyDays ?? defaultWarrantyDays;
            var paymentDueDays = request.CommercialTerms?.PaymentDueDays ?? job.ProposedPaymentDueDays ?? defaultPaymentDueDays;

            if (feeMultiplier < 0.1m || feeMultiplier > 10m)
            {
                throw new BadRequestException($"Điều khoản feeMultiplier không hợp lệ ({feeMultiplier}). Khoảng cho phép: 0.1 - 10.", "TERM_OUT_OF_RANGE");
            }

            if (warrantyDays < 1 || warrantyDays > 365)
            {
                throw new BadRequestException($"Điều khoản warrantyDays không hợp lệ ({warrantyDays}). Khoảng cho phép: 1 - 365 ngày.", "TERM_OUT_OF_RANGE");
            }

            if (paymentDueDays < 1 || paymentDueDays > 120)
            {
                throw new BadRequestException($"Điều khoản paymentDueDays không hợp lệ ({paymentDueDays}). Khoảng cho phép: 1 - 120 ngày.", "TERM_OUT_OF_RANGE");
            }

            var differsFromProposed = (job.ProposedFeeMultiplier.HasValue && job.ProposedFeeMultiplier.Value != feeMultiplier)
                || (job.ProposedWarrantyDays.HasValue && job.ProposedWarrantyDays.Value != warrantyDays)
                || (job.ProposedPaymentDueDays.HasValue && job.ProposedPaymentDueDays.Value != paymentDueDays);

            if (differsFromProposed && string.IsNullOrWhiteSpace(request.AgreementReference))
            {
                throw new BadRequestException("Số tiền/điều khoản chốt khác với đề xuất của Client, bắt buộc phải cung cấp thông tin thỏa thuận (agreementReference).", "AGREEMENT_REFERENCE_REQUIRED");
            }

            job.FeeMultiplier = feeMultiplier;
            job.WarrantyDays = warrantyDays;
            job.PaymentDueDays = paymentDueDays;
            job.AgreementReference = string.IsNullOrWhiteSpace(request.AgreementReference) ? null : request.AgreementReference.Trim();
            job.AgreementNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            job.AgreedAt = now;
            job.AgreedBy = request.UserId;

            approvedTerms = new
            {
                serviceTypeCode = ServiceTypeCodes.HeadhuntCod,
                feeMultiplier,
                warrantyDays,
                paymentDueDays
            };
        }
        else if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            if (request.CommercialTerms != null)
            {
                if (request.CommercialTerms.FeeMultiplier.HasValue || request.CommercialTerms.WarrantyDays.HasValue)
                {
                    throw new BadRequestException("Điều khoản thương mại gửi lên không áp dụng cho dịch vụ CV_SOURCING.", "TERM_NOT_APPLICABLE");
                }
            }

            var defaultPricePerCv = await _adminSettings.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, ct);
            var defaultDepositPercent = await _adminSettings.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, ct);
            var defaultReviewDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, ct);
            var defaultPaymentDueDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, ct);

            adminDefaultsAtApproval = new
            {
                pricePerCv = defaultPricePerCv,
                depositPercent = defaultDepositPercent,
                reviewDays = defaultReviewDays,
                paymentDueDays = defaultPaymentDueDays
            };

            var sourcingTarget = request.CommercialTerms?.SourcingTarget ?? job.SourcingTarget ?? 10;
            var pricePerCv = request.CommercialTerms?.PricePerCv ?? job.ProposedPricePerCv ?? defaultPricePerCv;
            var depositPercent = request.CommercialTerms?.DepositPercent ?? defaultDepositPercent;
            var reviewDays = request.CommercialTerms?.ReviewDays ?? defaultReviewDays;
            var paymentDueDays = request.CommercialTerms?.PaymentDueDays ?? job.ProposedPaymentDueDays ?? defaultPaymentDueDays;

            if (sourcingTarget < 1 || sourcingTarget > 1000)
            {
                throw new BadRequestException($"Điều khoản sourcingTarget không hợp lệ ({sourcingTarget}). Khoảng cho phép: 1 - 1000.", "TERM_OUT_OF_RANGE");
            }

            if (pricePerCv < 1000m || pricePerCv > 100000000m)
            {
                throw new BadRequestException($"Điều khoản pricePerCv không hợp lệ ({pricePerCv:N0}). Khoảng cho phép: 1.000 - 100.000.000 VNĐ.", "TERM_OUT_OF_RANGE");
            }

            if (depositPercent < 0m || depositPercent > 100m)
            {
                throw new BadRequestException($"Điều khoản depositPercent không hợp lệ ({depositPercent}%). Khoảng cho phép: 0 - 100%.", "TERM_OUT_OF_RANGE");
            }

            if (reviewDays < 1 || reviewDays > 30)
            {
                throw new BadRequestException($"Điều khoản reviewDays không hợp lệ ({reviewDays}). Khoảng cho phép: 1 - 30 ngày.", "TERM_OUT_OF_RANGE");
            }

            if (paymentDueDays < 1 || paymentDueDays > 120)
            {
                throw new BadRequestException($"Điều khoản paymentDueDays không hợp lệ ({paymentDueDays}). Khoảng cho phép: 1 - 120 ngày.", "TERM_OUT_OF_RANGE");
            }

            if (job.SourcingTarget.HasValue && sourcingTarget < job.SourcingTarget.Value && string.IsNullOrWhiteSpace(request.Note))
            {
                throw new BadRequestException("Khi giảm số lượng CV mục tiêu so với yêu cầu của Client, bắt buộc phải có ghi chú lý do.", "NOTE_REQUIRED");
            }

            var differsFromProposed = (job.ProposedPricePerCv.HasValue && job.ProposedPricePerCv.Value != pricePerCv)
                || (job.ProposedPaymentDueDays.HasValue && job.ProposedPaymentDueDays.Value != paymentDueDays);

            if (differsFromProposed && string.IsNullOrWhiteSpace(request.AgreementReference))
            {
                throw new BadRequestException("Số tiền/điều khoản chốt khác với đề xuất của Client, bắt buộc phải cung cấp thông tin thỏa thuận (agreementReference).", "AGREEMENT_REFERENCE_REQUIRED");
            }

            job.SourcingTarget = sourcingTarget;
            job.SourcingPricePerCv = pricePerCv;
            job.DepositPercent = depositPercent;
            job.ReviewDays = reviewDays;
            job.PaymentDueDays = paymentDueDays;
            job.AgreementReference = string.IsNullOrWhiteSpace(request.AgreementReference) ? null : request.AgreementReference.Trim();
            job.AgreementNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            job.AgreedAt = now;
            job.AgreedBy = request.UserId;

            approvedTerms = new
            {
                serviceTypeCode = ServiceTypeCodes.CvSourcing,
                sourcingTarget,
                pricePerCv,
                depositPercent,
                reviewDays,
                paymentDueDays
            };

            if (_sourcingFinance != null)
            {
                var deposit = await _sourcingFinance.EnsureDepositAsync(job, request.UserId, ct, serviceTypeCode);
                if (deposit != null && deposit.Status != ServiceFeeStates.Paid)
                {
                    requiresPayment = true;
                    awaitsSourcingDeposit = true;
                    standardPrice = deposit.Amount;
                }
            }
        }
        else if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvApplication, StringComparison.OrdinalIgnoreCase))
        {
            if (request.CommercialTerms != null &&
                (request.CommercialTerms.FeeMultiplier.HasValue ||
                 request.CommercialTerms.WarrantyDays.HasValue ||
                 request.CommercialTerms.PaymentDueDays.HasValue ||
                 request.CommercialTerms.SourcingTarget.HasValue ||
                 request.CommercialTerms.PricePerCv.HasValue ||
                 request.CommercialTerms.DepositPercent.HasValue ||
                 request.CommercialTerms.ReviewDays.HasValue))
            {
                throw new BadRequestException("Dịch vụ CV_APPLICATION không áp dụng điều khoản thương mại thương lượng.", "TERM_NOT_APPLICABLE");
            }

            var package = job.PostingPackage;
            if (package == null && job.PostingPackageId.HasValue)
            {
                package = await _jobs.GetPostingPackageByIdAsync(job.PostingPackageId.Value, ct);
            }

            if (package == null)
            {
                package = await _jobs.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, ct);
                if (package != null)
                {
                    job.PostingPackageId = package.PackageId;
                    job.PostingPackage = package;
                }
            }

            job.MaxApplications = package?.MaxApplications;
            var fee = await _jobs.GetPostingFeeByJobIdAsync(job.JobId, ct);

            if (package != null && string.Equals(package.Code, JobPostingPackageCodes.Standard, StringComparison.OrdinalIgnoreCase))
            {
                standardPrice = package.Price;

                if (fee == null)
                {
                    fee = new JobPostingFee
                    {
                        PostingFeeId = Guid.NewGuid(),
                        JobId = job.JobId,
                        PackageId = package.PackageId,
                        CompanyId = job.CompanyId,
                        Amount = standardPrice,
                        CurrencyCode = "VND",
                        Status = JobPostingFeeStatuses.Pending,
                        CreatedAt = now,
                        UpdatedAt = now
                    };
                    await _jobs.AddPostingFeeAsync(fee, ct);
                }

                if (fee.Status != JobPostingFeeStatuses.Paid)
                {
                    if (!string.IsNullOrWhiteSpace(request.PaymentReference))
                    {
                        fee.Status = JobPostingFeeStatuses.Paid;
                        fee.PaidAt = now;
                        fee.PaymentReference = request.PaymentReference.Trim();
                        fee.RecordedBy = request.UserId;
                        fee.UpdatedAt = now;
                    }
                    else
                    {
                        requiresPayment = true;
                    }
                }
            }

            var duration = package?.DurationDays > 0 ? package.DurationDays : 30;

            if (!requiresPayment)
            {
                job.ExpiresAt = now.AddDays(duration);
                if (fee != null)
                {
                    fee.ActivatedAt = now;
                    fee.ExpiresAt = job.ExpiresAt;
                    fee.UpdatedAt = now;
                }
            }
        }

        if (requiresPayment)
        {
            JobTransitions.ChangeStatus(
                job,
                JobStatuses.PendingPayment,
                request.UserId,
                JobReasonCodes.Approved,
                awaitsSourcingDeposit
                    ? "Nội dung tin tuyển dụng đã được duyệt. Vui lòng đặt cọc CV Sourcing để công bố."
                    : "Nội dung tin tuyển dụng đã được duyệt. Vui lòng thanh toán phí dịch vụ để công bố.");
            await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);

            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = job.CreatedBy,
                NotificationType = "JOB",
                Title = "Tin tuyển dụng đã được duyệt nội dung",
                Message = awaitsSourcingDeposit
                    ? $"Tin tuyển dụng \"{job.Title}\" đã được phê duyệt nội dung. Vui lòng đặt cọc CV Sourcing ({standardPrice:N0} đ) để công bố."
                    : $"Tin tuyển dụng \"{job.Title}\" đã được phê duyệt nội dung. Vui lòng thanh toán phí đăng tin ({standardPrice:N0} đ) để công bố.",
                RelatedEntityType = "JOB",
                RelatedEntityId = job.JobId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    jobId = job.JobId,
                    status = JobStatuses.PendingPayment,
                    amount = standardPrice,
                    paymentKind = awaitsSourcingDeposit ? ServiceFeeKinds.Deposit : "POSTING_FEE",
                    actionRoute = $"/client/jobs?highlight={job.JobId}&openPayment=true"
                }),
                IsRead = false,
                CreatedAt = now
            }, ct);

            await AuditApprovalAsync(job, request, proposedTerms, adminDefaultsAtApproval, approvedTerms, ct);
            await _uow.SaveChangesAsync(ct);
            return new(true, "Duyệt nội dung thành công. Tin tuyển dụng đã chuyển sang trạng thái Chờ thanh toán.", JobDto.From(job, isReviewer: true));
        }

        JobTransitions.ChangeStatus(job, JobStatuses.Active, request.UserId, JobReasonCodes.Approved);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        job.PostedAt = now;
        job.ClosedAt = null;

        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = job.CreatedBy,
            NotificationType = "JOB",
            Title = "Tin tuyển dụng đã được duyệt",
            Message = $"Tin tuyển dụng \"{job.Title}\" đã được phê duyệt và công bố.",
            RelatedEntityType = "JOB",
            RelatedEntityId = job.JobId,
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                jobId = job.JobId,
                status = JobStatuses.Active,
                expiresAt = job.ExpiresAt,
                actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
            }),
            IsRead = false,
            CreatedAt = now
        }, ct);

        await AuditApprovalAsync(job, request, proposedTerms, adminDefaultsAtApproval, approvedTerms, ct);
        await _uow.SaveChangesAsync(ct);
        return new(true, "Duyệt và công bố công việc thành công.", JobDto.From(job, isReviewer: true));
    }

    private Task AuditApprovalAsync(
        Job job,
        ApproveJobCommand request,
        object proposedTerms,
        object? adminDefaultsAtApproval,
        object? approvedTerms,
        CancellationToken ct)
    {
        return _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.JobApproved,
            EntityType = "JOB",
            EntityId = job.JobId,
            ActorUserId = request.UserId,
            NewValues = new
            {
                jobId = job.JobId,
                status = job.Status,
                proposedTerms,
                adminDefaultsAtApproval,
                approvedTerms,
                agreementReference = request.AgreementReference,
                note = request.Note,
                paymentReference = request.PaymentReference
            }
        }, ct);
    }
}
