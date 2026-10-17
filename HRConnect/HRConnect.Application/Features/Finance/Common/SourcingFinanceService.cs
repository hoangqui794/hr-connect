using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Finance.Common;

/// <summary>
/// MF-05 money for CV_SOURCING (QUY-TAC-PHI section 2, docs/MF05 section E8):
/// a DEPOSIT when the job is approved, one commission per counted CV, and a SETTLEMENT
/// (or CREDIT when the deposit was larger) once the target is reached or the job closes.
/// Every method adds to the caller's unit of work and is safe to call again.
/// </summary>
public interface ISourcingFinanceService
{
    /// <summary>Creates the job's DEPOSIT fee when it has none. Returns null when no deposit is due.</summary>
    Task<ServiceFee?> EnsureDepositAsync(Job job, Guid? actorUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Called when a delivery becomes ACCEPTED or AUTO_ACCEPTED: the affiliate earns the per-CV commission,
    /// and the job is settled when the counted CVs reach the sourcing target.
    /// </summary>
    Task OnDeliveryCountedAsync(SourcingDelivery delivery, Guid? actorUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Bills counted CVs × price per CV minus the deposit. Returns the existing closing fee when the job
    /// was already settled.
    /// </summary>
    Task<ServiceFee> SettleAsync(Job job, Guid? actorUserId, CancellationToken cancellationToken = default);
}

public sealed class SourcingFinanceService : ISourcingFinanceService
{
    private const string DefaultCurrency = "VND";
    private static readonly JsonSerializerOptions SnapshotJson = new(JsonSerializerDefaults.Web);

    private readonly IFinanceRepository _financeRepository;
    private readonly ISourcingDeliveryRepository _deliveries;
    private readonly IAuditLogService _auditLogService;
    private readonly IAdminBusinessSettings _settings;
    private readonly ILogger<SourcingFinanceService> _logger;

    public SourcingFinanceService(
        IFinanceRepository financeRepository,
        ISourcingDeliveryRepository deliveries,
        IAuditLogService auditLogService,
        IAdminBusinessSettings settings,
        ILogger<SourcingFinanceService> logger)
    {
        _financeRepository = financeRepository;
        _deliveries = deliveries;
        _auditLogService = auditLogService;
        _settings = settings;
        _logger = logger;
    }

    public async Task<ServiceFee?> EnsureDepositAsync(Job job, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        if (!IsSourcing(job) || job.AgreedAt == null)
        {
            return null;
        }

        var fees = await _financeRepository.GetJobServiceFeesForUpdateAsync(job.JobId, cancellationToken);
        var existing = fees.FirstOrDefault(fee => fee.Kind == ServiceFeeKinds.Deposit);
        if (existing != null)
        {
            return existing;
        }

        // The agreed numbers live on the job (MF-01 approval); a job without them cannot be billed.
        var depositPercent = job.DepositPercent ?? 0m;
        if (depositPercent <= 0m || job.SourcingTarget is not > 0 || job.SourcingPricePerCv is not > 0m)
        {
            return null;
        }

        var package = job.SourcingTarget.Value * job.SourcingPricePerCv.Value;
        var multiplier = depositPercent / 100m;
        var now = DateTime.UtcNow;
        var fee = new ServiceFee
        {
            ServiceFeeId = Guid.NewGuid(),
            JobId = job.JobId,
            Kind = ServiceFeeKinds.Deposit,
            CompanyId = job.CompanyId,
            BaseSalary = package,
            FeeMultiplier = multiplier,
            Amount = Round(package * multiplier),
            CurrencyCode = DefaultCurrency,
            DueDate = Today(now).AddDays(await PaymentDueDaysAsync(job, cancellationToken)),
            Status = ServiceFeeStates.Pending,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _financeRepository.AddServiceFeeAsync(fee, cancellationToken);

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.SourcingDepositCreated,
            EntityType = "SERVICE_FEE",
            EntityId = fee.ServiceFeeId,
            ActorUserId = actorUserId,
            NewValues = new
            {
                jobId = job.JobId,
                sourcingTarget = job.SourcingTarget,
                pricePerCv = job.SourcingPricePerCv,
                depositPercent,
                fee.Amount,
                fee.DueDate
            }
        }, cancellationToken);

        _logger.LogInformation("MF-05: job {JobId} deposit {Amount} created.", job.JobId, fee.Amount);
        return fee;
    }

    public async Task OnDeliveryCountedAsync(SourcingDelivery delivery, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        if (!SourcingDeliveryStates.Counted.Contains(delivery.Status))
        {
            return;
        }

        var job = delivery.Job ?? await _financeRepository.GetJobForFinanceAsync(delivery.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy công việc của CV đã giao.");
        if (!IsSourcing(job) || job.SourcingPricePerCv is not > 0m)
        {
            return;
        }

        await EarnCommissionAsync(job, delivery, actorUserId, cancellationToken);

        // Tracked deliveries carry the status just set by the caller, so this delivery is counted.
        var deliveries = await _deliveries.GetByJobAsync(job.JobId, cancellationToken);
        var counted = deliveries.Count(d => SourcingDeliveryStates.Counted.Contains(d.Status));
        if (job.SourcingTarget is > 0 && counted >= job.SourcingTarget.Value)
        {
            await SettleAsync(job, actorUserId, cancellationToken);
        }
    }

    public async Task<ServiceFee> SettleAsync(Job job, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        if (!IsSourcing(job))
        {
            throw new ConflictException("Chỉ job CV_SOURCING mới quyết toán theo số CV.", "JOB_NOT_SOURCING");
        }

        if (job.SourcingPricePerCv is not > 0m)
        {
            throw new ConflictException("Job chưa có giá mỗi CV đã chốt nên chưa quyết toán được.", "SOURCING_TERMS_MISSING");
        }

        var fees = await _financeRepository.GetJobServiceFeesForUpdateAsync(job.JobId, cancellationToken);
        var closing = fees.FirstOrDefault(fee => ServiceFeeKinds.Closing.Contains(fee.Kind));
        if (closing != null)
        {
            return closing;
        }

        var deliveries = await _deliveries.GetByJobAsync(job.JobId, cancellationToken);
        var counted = deliveries.Count(d => SourcingDeliveryStates.Counted.Contains(d.Status));
        var total = counted * job.SourcingPricePerCv.Value;
        var deposit = fees.Where(fee => fee.Kind == ServiceFeeKinds.Deposit && fee.Status != ServiceFeeStates.Cancelled)
            .Sum(fee => fee.Amount);
        var balance = Round(total - deposit);

        var now = DateTime.UtcNow;
        var fee = new ServiceFee
        {
            ServiceFeeId = Guid.NewGuid(),
            JobId = job.JobId,
            // Under-delivery: the unused part of the deposit is refunded or deducted next time.
            Kind = balance < 0 ? ServiceFeeKinds.Credit : ServiceFeeKinds.Settlement,
            CompanyId = job.CompanyId,
            BaseSalary = total,
            FeeMultiplier = 1m,
            Amount = Math.Abs(balance),
            CurrencyCode = DefaultCurrency,
            DueDate = Today(now).AddDays(await PaymentDueDaysAsync(job, cancellationToken)),
            Status = ServiceFeeStates.Pending,
            CreatedAt = now,
            UpdatedAt = now,
        };

        if (fee.Amount == 0m)
        {
            // The deposit covered every counted CV exactly: nothing more to collect or refund.
            fee.Status = ServiceFeeStates.Paid;
            fee.PaidAt = now;
            fee.PaymentReference = "DEPOSIT_COVERED";
        }

        await _financeRepository.AddServiceFeeAsync(fee, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.SourcingSettlementCreated,
            EntityType = "SERVICE_FEE",
            EntityId = fee.ServiceFeeId,
            ActorUserId = actorUserId,
            NewValues = new
            {
                jobId = job.JobId,
                fee.Kind,
                countedCvs = counted,
                pricePerCv = job.SourcingPricePerCv,
                total,
                deposit,
                fee.Amount,
                fee.Status
            }
        }, cancellationToken);

        _logger.LogInformation(
            "MF-05: job {JobId} settled: {Counted} CV, total {Total}, deposit {Deposit}, {Kind} {Amount}.",
            job.JobId, counted, total, deposit, fee.Kind, fee.Amount);
        return fee;
    }

    private async Task EarnCommissionAsync(Job job, SourcingDelivery delivery, Guid? actorUserId, CancellationToken cancellationToken)
    {
        if (await _financeRepository.HasSourcingCommissionAsync(delivery.DeliveryId, cancellationToken))
        {
            return;
        }

        var attribution = await _financeRepository.GetActiveAttributionAsync(delivery.ApplicationId, cancellationToken);
        if (attribution == null)
        {
            _logger.LogWarning(
                "MF-05: CV {DeliveryId} được tính nhưng không có attribution ACTIVE; không tạo hoa hồng.", delivery.DeliveryId);
            return;
        }

        // Fund = fee × share; per CV = fund ÷ sourcing target = price per CV × share.
        var sharePercent = await _settings.GetDecimalAsync(BusinessSettingKeys.CvSourcingAffiliateSharePercent, cancellationToken);
        var pricePerCv = job.SourcingPricePerCv!.Value;
        var amount = Round(pricePerCv * sharePercent / 100m);
        var now = DateTime.UtcNow;
        var commission = new Commission
        {
            CommissionId = Guid.NewGuid(),
            AttributionId = attribution.AttributionId,
            SourcingDeliveryId = delivery.DeliveryId,
            MilestoneType = CommissionMilestoneCodes.CvAccepted,
            BaseAmount = pricePerCv,
            Amount = amount,
            Status = CommissionStates.Earned,
            RuleSnapshot = JsonSerializer.Serialize(new
            {
                source = "system_setting",
                key = BusinessSettingKeys.CvSourcingAffiliateSharePercent,
                sharePercent
            }, SnapshotJson),
            CalculationSnapshot = JsonSerializer.Serialize(new
            {
                jobId = job.JobId,
                deliveryId = delivery.DeliveryId,
                deliveryStatus = delivery.Status,
                pricePerCv,
                sharePercent,
                sourcingTarget = job.SourcingTarget,
                amount
            }, SnapshotJson),
            CalculatedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _financeRepository.AddCommissionAsync(commission, cancellationToken);

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.CommissionEarned,
            EntityType = "COMMISSION",
            EntityId = commission.CommissionId,
            ActorUserId = actorUserId,
            NewValues = new { commission.Status, commission.Amount, deliveryId = delivery.DeliveryId, jobId = job.JobId }
        }, cancellationToken);
    }

    private async Task<int> PaymentDueDaysAsync(Job job, CancellationToken cancellationToken) =>
        job.PaymentDueDays is > 0
            ? job.PaymentDueDays.Value
            : await _settings.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, cancellationToken);

    private static bool IsSourcing(Job job) =>
        string.Equals(job.ServiceType?.Code, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase);

    private static DateOnly Today(DateTime utcNow) => DateOnly.FromDateTime(utcNow);

    private static decimal Round(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
