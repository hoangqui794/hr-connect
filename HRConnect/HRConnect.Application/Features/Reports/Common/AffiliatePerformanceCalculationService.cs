using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Reports.Common;

public class AffiliatePerformanceCalculationService : IAffiliatePerformanceCalculationService
{
    private readonly IAffiliatePerformanceRepository _repository;
    private readonly IAdminBusinessSettings _settings;
    private readonly ILogger<AffiliatePerformanceCalculationService> _logger;

    public const string CurrentCalculationVersion = "v1";

    public AffiliatePerformanceCalculationService(
        IAffiliatePerformanceRepository repository,
        IAdminBusinessSettings settings,
        ILogger<AffiliatePerformanceCalculationService> logger)
    {
        _repository = repository;
        _settings = settings;
        _logger = logger;
    }

    public async Task<AffiliatePerformance> CalculateAndUpsertAsync(
        Guid affiliateId,
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken = default)
    {
        var metrics = await _repository.ComputeMetricsAsync(affiliateId, periodStart, periodEnd, cancellationToken);
        var config = await AffiliateRatingConfig.LoadAsync(_settings, cancellationToken);

        var ratingResult = AffiliateRatingCalculator.Calculate(
            metrics.Submissions,
            metrics.Shortlisted,
            metrics.Placements,
            config);

        var entity = new AffiliatePerformance
        {
            AffiliatePerformanceId = Guid.NewGuid(),
            AffiliateId = affiliateId,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            TotalSubmissions = metrics.Submissions,
            TotalShortlisted = metrics.Shortlisted,
            TotalInterviews = metrics.Interviews,
            TotalPlacements = metrics.Placements,
            SubmissionToHireRate = ratingResult.SubmissionToHireRate,
            QualityRating = ratingResult.QualityRating,
            RatingLabel = ratingResult.RatingLabel,
            CalculationVersion = CurrentCalculationVersion,
            CalculatedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        return await _repository.UpsertPerformanceAsync(entity, cancellationToken);
    }

    public async Task<int> RecalculateAllActiveAffiliatesAsync(
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken = default)
    {
        var activeAffiliates = await _repository.GetActiveAffiliatesAsync(cancellationToken);
        int successCount = 0;

        foreach (var affiliate in activeAffiliates)
        {
            try
            {
                await CalculateAndUpsertAsync(affiliate.AffiliateId, periodStart, periodEnd, cancellationToken);
                successCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tính hiệu suất cho Affiliate {AffiliateId} trong kỳ {PeriodStart} - {PeriodEnd}",
                    affiliate.AffiliateId, periodStart, periodEnd);
            }
        }

        return successCount;
    }
}
