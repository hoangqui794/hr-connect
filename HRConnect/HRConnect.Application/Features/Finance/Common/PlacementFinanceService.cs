using System.Text.Json;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Finance.Common;

public sealed record PlacementFinanceResult(
    bool Applicable,
    Guid? WarrantyId,
    DateOnly? WarrantyEndDate,
    Guid? ServiceFeeId,
    decimal? ServiceFeeAmount,
    Guid? CommissionId,
    decimal? CommissionAmount,
    IReadOnlyList<string> Warnings);

public interface IPlacementFinanceService
{
    /// <summary>
    /// Creates the MF-05 records for a new placement in the caller's unit of work (no SaveChanges).
    /// Only HEADHUNT_COD jobs get a warranty, a service fee and (with an active attribution and rule) a commission.
    /// </summary>
    Task<PlacementFinanceResult> InitializeAsync(
        Placement placement, JobApplicationContext context, Guid actorUserId, CancellationToken cancellationToken = default);
}

/// <summary>What the placement handler already loaded; avoids reloading the application.</summary>
public sealed record JobApplicationContext(
    Guid ApplicationId,
    Guid CompanyId,
    Guid ServiceTypeId,
    string? ServiceTypeCode,
    Offer Offer,
    decimal? FeeMultiplier = null,
    int? WarrantyDays = null,
    int? PaymentDueDays = null,
    /// <summary>
    /// The already-paid service fee that funds one free replacement. When present,
    /// a fresh warranty and commission are created for the replacement placement,
    /// but no second service-fee record is created.
    /// </summary>
    ServiceFee? ReplacementSourceServiceFee = null);

public sealed class PlacementFinanceService : IPlacementFinanceService
{
    private static readonly JsonSerializerOptions SnapshotJson = new(JsonSerializerDefaults.Web);

    private readonly IFinanceRepository _financeRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly IAdminBusinessSettings _settings;
    private readonly ILogger<PlacementFinanceService> _logger;

    public PlacementFinanceService(
        IFinanceRepository financeRepository,
        IAuditLogService auditLogService,
        IAdminBusinessSettings settings,
        ILogger<PlacementFinanceService> logger)
    {
        _financeRepository = financeRepository;
        _auditLogService = auditLogService;
        _settings = settings;
        _logger = logger;
    }

    public async Task<PlacementFinanceResult> InitializeAsync(
        Placement placement, JobApplicationContext context, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(context.ServiceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            return new PlacementFinanceResult(false, null, null, null, null, null, null, Array.Empty<string>());
        }

        var isReplacement = context.ReplacementSourceServiceFee != null;
        // A replacement is funded by an existing paid fee. Its offer salary must not
        // block a legitimate free replacement for legacy offers because it is not
        // used to calculate a new service fee.
        var monthlyGrossSalary = isReplacement
            ? OfferSalaryPolicy.CalculateMonthlyGrossSalary(
                context.Offer.Salary,
                context.Offer.SalaryBasis,
                context.Offer.SalaryPeriod)
            : OfferSalaryPolicy.EnsureReadyForSending(context.Offer, context.ServiceTypeCode)
                ?? throw new BadRequestException(
                    "Không xác định được lương gross theo tháng để tính phí dịch vụ.",
                    OfferSalaryErrorCodes.Incomplete);

        var now = DateTime.UtcNow;
        var warnings = new List<string>();

        // Terms agreed on the job (MF-01) win; otherwise the Admin-configurable defaults
        // (system_setting), which start from the business-model documents.
        var warrantyDays = context.WarrantyDays is > 0
            ? context.WarrantyDays.Value
            : await _settings.GetIntAsync(BusinessSettingKeys.HeadhuntWarrantyDays, cancellationToken);
        var warranty = new Warranty
        {
            WarrantyId = Guid.NewGuid(),
            PlacementId = placement.PlacementId,
            StartDate = placement.ActualStartDate,
            EndDate = placement.ActualStartDate.AddDays(warrantyDays),
            Status = WarrantyStates.Active,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _financeRepository.AddWarrantyAsync(warranty, cancellationToken);

        ServiceFee? newFee = null;
        ServiceFee commissionBaseFee;
        if (isReplacement)
        {
            commissionBaseFee = context.ReplacementSourceServiceFee!;
        }
        else
        {
            var feeMultiplier = context.FeeMultiplier is > 0
                ? context.FeeMultiplier.Value
                : await _settings.GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier, cancellationToken);
            var paymentDueDays = context.PaymentDueDays is > 0
                ? context.PaymentDueDays.Value
                : await _settings.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, cancellationToken);

            newFee = new ServiceFee
            {
                ServiceFeeId = Guid.NewGuid(),
                PlacementId = placement.PlacementId,
                CompanyId = context.CompanyId,
                BaseSalary = monthlyGrossSalary!.Value,
                FeeMultiplier = feeMultiplier,
                Amount = decimal.Round(monthlyGrossSalary.Value * feeMultiplier, 2, MidpointRounding.AwayFromZero),
                CurrencyCode = string.IsNullOrWhiteSpace(context.Offer.CurrencyCode) ? "VND" : context.Offer.CurrencyCode.Trim().ToUpperInvariant(),
                DueDate = placement.ActualStartDate.AddDays(paymentDueDays),
                Status = ServiceFeeStates.Pending,
                CreatedAt = now,
                UpdatedAt = now,
            };
            await _financeRepository.AddServiceFeeAsync(newFee, cancellationToken);
            commissionBaseFee = newFee;
        }

        Commission? commission = null;
        var attribution = await _financeRepository.GetActiveAttributionAsync(context.ApplicationId, cancellationToken);
        if (attribution == null)
        {
            warnings.Add("NO_AFFILIATE_ATTRIBUTION");
        }
        else
        {
            var rule = await _financeRepository.GetActiveCommissionRuleAsync(context.ServiceTypeId, now, cancellationToken);
            var amount = rule == null ? null : CalculateCommission(rule, commissionBaseFee);
            if (rule == null)
            {
                warnings.Add("NO_ACTIVE_COMMISSION_RULE");
            }
            else if (amount == null)
            {
                warnings.Add("COMMISSION_BASE_MISSING");
            }
            else
            {
                commission = new Commission
                {
                    CommissionId = Guid.NewGuid(),
                    AttributionId = attribution.AttributionId,
                    PlacementId = placement.PlacementId,
                    CommissionRuleId = rule.CommissionRuleId,
                    MilestoneType = CommissionMilestoneCodes.WarrantyPassed,
                    BaseAmount = IsPercent(rule) ? commissionBaseFee.Amount : null,
                    Amount = amount.Value,
                    Status = CommissionStates.InWarranty,
                    RuleSnapshot = JsonSerializer.Serialize(new
                    {
                        rule.CommissionRuleId,
                        rule.Name,
                        rule.RateType,
                        rule.RateValue,
                        rule.MilestoneType,
                        rule.WarrantyRequired,
                    }, SnapshotJson),
                    CalculationSnapshot = JsonSerializer.Serialize(new
                    {
                        serviceFeeAmount = commissionBaseFee.Amount,
                        currencyCode = commissionBaseFee.CurrencyCode,
                        rateType = rule.RateType,
                        rateValue = rule.RateValue,
                        commissionAmount = amount.Value,
                        isReplacement,
                        replacementSourceServiceFeeId = isReplacement ? (Guid?)commissionBaseFee.ServiceFeeId : null,
                        stage = "candidate_started_work_on_hold_during_warranty",
                        earnedWhen = $"warranty passed ({warrantyDays} days after {placement.ActualStartDate:yyyy-MM-dd})",
                    }, SnapshotJson),
                    CalculatedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now,
                };
                await _financeRepository.AddCommissionAsync(commission, cancellationToken);
            }
        }

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.PlacementFinanceInitialized,
            EntityType = "PLACEMENT",
            EntityId = placement.PlacementId,
            ActorUserId = actorUserId,
            NewValues = new
            {
                warrantyId = warranty.WarrantyId,
                warrantyEndDate = warranty.EndDate,
                serviceFeeId = newFee?.ServiceFeeId,
                serviceFeeAmount = newFee?.Amount,
                isReplacement,
                replacementSourceServiceFeeId = isReplacement ? (Guid?)commissionBaseFee.ServiceFeeId : null,
                replacementSourceServiceFeeAmount = isReplacement ? (decimal?)commissionBaseFee.Amount : null,
                offeredSalary = context.Offer.Salary,
                salaryBasis = context.Offer.SalaryBasis,
                salaryPeriod = context.Offer.SalaryPeriod,
                monthlyGrossSalary,
                commissionId = commission?.CommissionId,
                commissionAmount = commission?.Amount,
                warnings,
            },
        }, cancellationToken);

        return new PlacementFinanceResult(
            true, warranty.WarrantyId, warranty.EndDate, newFee?.ServiceFeeId, newFee?.Amount,
            commission?.CommissionId, commission?.Amount, warnings);
    }

    private static bool IsPercent(CommissionRule rule) =>
        string.Equals(rule.RateType, "PERCENT", StringComparison.OrdinalIgnoreCase);

    /// <summary>PERCENT is a share of the service fee; FIXED is the configured amount.</summary>
    public static decimal? CalculateCommission(CommissionRule rule, ServiceFee? fee)
    {
        if (rule.RateValue is not decimal rate || rate <= 0)
        {
            return null;
        }

        if (IsPercent(rule))
        {
            return fee == null ? null : decimal.Round(fee.Amount * rate / 100m, 2, MidpointRounding.AwayFromZero);
        }

        return string.Equals(rule.RateType, "FIXED", StringComparison.OrdinalIgnoreCase) ? rate : null;
    }
}
