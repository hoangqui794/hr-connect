using System.Text.Json;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

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
public sealed record JobApplicationContext(Guid ApplicationId, Guid CompanyId, Guid ServiceTypeId, string? ServiceTypeCode, Offer Offer);

public sealed class PlacementFinanceService : IPlacementFinanceService
{
    private static readonly JsonSerializerOptions SnapshotJson = new(JsonSerializerDefaults.Web);

    private readonly IFinanceRepository _financeRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly Mf05Settings _settings;
    private readonly ILogger<PlacementFinanceService> _logger;

    public PlacementFinanceService(
        IFinanceRepository financeRepository,
        IAuditLogService auditLogService,
        IOptions<Mf05Settings> settings,
        ILogger<PlacementFinanceService> logger)
    {
        _financeRepository = financeRepository;
        _auditLogService = auditLogService;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<PlacementFinanceResult> InitializeAsync(
        Placement placement, JobApplicationContext context, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(context.ServiceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            return new PlacementFinanceResult(false, null, null, null, null, null, null, Array.Empty<string>());
        }

        var now = DateTime.UtcNow;
        var warnings = new List<string>();

        var warranty = new Warranty
        {
            WarrantyId = Guid.NewGuid(),
            PlacementId = placement.PlacementId,
            StartDate = placement.ActualStartDate,
            EndDate = placement.ActualStartDate.AddDays(_settings.WarrantyDays),
            Status = WarrantyStates.Active,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _financeRepository.AddWarrantyAsync(warranty, cancellationToken);

        ServiceFee? fee = null;
        if (context.Offer.Salary is decimal salary && salary > 0)
        {
            fee = new ServiceFee
            {
                ServiceFeeId = Guid.NewGuid(),
                PlacementId = placement.PlacementId,
                CompanyId = context.CompanyId,
                BaseSalary = salary,
                FeeMultiplier = _settings.HeadhuntFeeMultiplier,
                Amount = decimal.Round(salary * _settings.HeadhuntFeeMultiplier, 2, MidpointRounding.AwayFromZero),
                CurrencyCode = string.IsNullOrWhiteSpace(context.Offer.CurrencyCode) ? "VND" : context.Offer.CurrencyCode.Trim().ToUpperInvariant(),
                DueDate = placement.ActualStartDate.AddDays(_settings.PaymentDueDays),
                Status = ServiceFeeStates.Pending,
                CreatedAt = now,
                UpdatedAt = now,
            };
            await _financeRepository.AddServiceFeeAsync(fee, cancellationToken);
        }
        else
        {
            warnings.Add("SERVICE_FEE_SALARY_MISSING");
            _logger.LogWarning("Placement {PlacementId}: offer has no salary, service fee not created.", placement.PlacementId);
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
            var amount = rule == null ? null : CalculateCommission(rule, fee);
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
                    BaseAmount = IsPercent(rule) ? fee?.Amount : null,
                    Amount = amount.Value,
                    Status = CommissionStates.Pending,
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
                        serviceFeeAmount = fee?.Amount,
                        currencyCode = fee?.CurrencyCode,
                        rateType = rule.RateType,
                        rateValue = rule.RateValue,
                        commissionAmount = amount.Value,
                        earnedWhen = $"warranty passed ({_settings.WarrantyDays} days after {placement.ActualStartDate:yyyy-MM-dd})",
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
                serviceFeeId = fee?.ServiceFeeId,
                serviceFeeAmount = fee?.Amount,
                commissionId = commission?.CommissionId,
                commissionAmount = commission?.Amount,
                warnings,
            },
        }, cancellationToken);

        return new PlacementFinanceResult(
            true, warranty.WarrantyId, warranty.EndDate, fee?.ServiceFeeId, fee?.Amount,
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
