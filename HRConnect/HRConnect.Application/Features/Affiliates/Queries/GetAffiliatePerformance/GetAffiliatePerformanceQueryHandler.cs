using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Reports.Common;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;

public class GetAffiliatePerformanceQueryHandler : IRequestHandler<GetAffiliatePerformanceQuery, AffiliatePerformanceResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly IAffiliatePerformanceRepository _performanceRepository;
    private readonly IAffiliatePerformanceCalculationService _calculationService;
    private readonly ILogger<GetAffiliatePerformanceQueryHandler> _logger;

    public GetAffiliatePerformanceQueryHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        IAffiliatePerformanceRepository performanceRepository,
        IAffiliatePerformanceCalculationService calculationService,
        ILogger<GetAffiliatePerformanceQueryHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _performanceRepository = performanceRepository;
        _calculationService = calculationService;
        _logger = logger;
    }

    public async Task<AffiliatePerformanceResponse> Handle(
        GetAffiliatePerformanceQuery request,
        CancellationToken cancellationToken)
    {
        var profile = await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy thông tin đối tác tuyển dụng cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin đối tác tuyển dụng tương ứng với tài khoản này.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var (periodStart, periodEnd) = ResolvePeriod(request.Period, today);

        // 1. Lấy snapshot cho kỳ được yêu cầu
        var currentPerformance = await _performanceRepository.GetByPeriodAsync(
            profile.AffiliateId,
            periodStart,
            periodEnd,
            cancellationToken);

        // Nếu chưa có snapshot kỳ hiện tại, tự động tính và lưu lại
        if (currentPerformance == null)
        {
            currentPerformance = await _calculationService.CalculateAndUpsertAsync(
                profile.AffiliateId,
                periodStart,
                periodEnd,
                cancellationToken);
        }

        // 2. Lấy lịch sử các kỳ trước
        var historyList = await _performanceRepository.GetHistoryAsync(
            profile.AffiliateId,
            limit: 12,
            cancellationToken);

        var historyItems = historyList
            .Select(h => new AffiliatePerformanceHistoryItem
            {
                AffiliatePerformanceId = h.AffiliatePerformanceId,
                PeriodStart = h.PeriodStart,
                PeriodEnd = h.PeriodEnd,
                TotalSubmissions = h.TotalSubmissions,
                TotalShortlisted = h.TotalShortlisted,
                TotalInterviews = h.TotalInterviews,
                TotalPlacements = h.TotalPlacements,
                SubmissionToHireRate = h.SubmissionToHireRate,
                QualityRating = h.QualityRating,
                RatingLabel = h.RatingLabel,
                CalculationVersion = h.CalculationVersion,
                CalculatedAt = h.CalculatedAt
            })
            .ToList();

        return new AffiliatePerformanceResponse
        {
            Success = true,
            Message = "Lấy thống kê hiệu suất đối tác tuyển dụng thành công.",
            Data = new AffiliatePerformanceData
            {
                AffiliateId = profile.AffiliateId,
                DisplayName = profile.DisplayName,
                AffiliateType = profile.AffiliateType,
                Status = profile.Status,
                PeriodStart = currentPerformance?.PeriodStart ?? periodStart,
                PeriodEnd = currentPerformance?.PeriodEnd ?? periodEnd,
                TotalSubmissions = currentPerformance?.TotalSubmissions ?? 0,
                TotalShortlisted = currentPerformance?.TotalShortlisted ?? 0,
                TotalInterviews = currentPerformance?.TotalInterviews ?? 0,
                TotalPlacements = currentPerformance?.TotalPlacements ?? 0,
                SubmissionToHireRate = currentPerformance?.SubmissionToHireRate,
                QualityRating = currentPerformance?.QualityRating,
                RatingLabel = currentPerformance?.RatingLabel ?? AffiliateRatingCalculator.LabelNew,
                CalculationVersion = currentPerformance?.CalculationVersion ?? AffiliatePerformanceCalculationService.CurrentCalculationVersion,
                CalculatedAt = currentPerformance?.CalculatedAt,
                History = historyItems
            }
        };
    }

    private static (DateOnly Start, DateOnly End) ResolvePeriod(string? period, DateOnly today)
    {
        var normalized = period?.Trim().ToUpperInvariant() ?? "MONTH";
        return normalized switch
        {
            "QUARTER" => CalculateQuarterPeriod(today),
            "YEAR" => (new DateOnly(today.Year, 1, 1), new DateOnly(today.Year, 12, 31)),
            _ => (new DateOnly(today.Year, today.Month, 1), new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month)))
        };
    }

    private static (DateOnly Start, DateOnly End) CalculateQuarterPeriod(DateOnly today)
    {
        int quarter = (today.Month - 1) / 3 + 1;
        int quarterStartMonth = (quarter - 1) * 3 + 1;
        var start = new DateOnly(today.Year, quarterStartMonth, 1);
        int quarterEndMonth = quarterStartMonth + 2;
        var end = new DateOnly(today.Year, quarterEndMonth, DateTime.DaysInMonth(today.Year, quarterEndMonth));
        return (start, end);
    }
}
