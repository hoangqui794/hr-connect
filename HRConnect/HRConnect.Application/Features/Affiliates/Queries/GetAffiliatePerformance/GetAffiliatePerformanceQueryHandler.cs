using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;

public class GetAffiliatePerformanceQueryHandler : IRequestHandler<GetAffiliatePerformanceQuery, AffiliatePerformanceResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly ILogger<GetAffiliatePerformanceQueryHandler> _logger;

    public GetAffiliatePerformanceQueryHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        ILogger<GetAffiliatePerformanceQueryHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
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

        var latestPerformance = await _affiliateProfileRepository.GetLatestPerformanceByAffiliateIdAsync(profile.AffiliateId, cancellationToken);

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
                PeriodStart = latestPerformance?.PeriodStart,
                PeriodEnd = latestPerformance?.PeriodEnd,
                TotalSubmissions = latestPerformance?.TotalSubmissions ?? 0,
                TotalShortlisted = latestPerformance?.TotalShortlisted ?? 0,
                TotalInterviews = latestPerformance?.TotalInterviews ?? 0,
                TotalPlacements = latestPerformance?.TotalPlacements ?? 0,
                SubmissionToHireRate = latestPerformance?.SubmissionToHireRate ?? 0m,
                QualityRating = latestPerformance?.QualityRating,
                RatingLabel = latestPerformance?.RatingLabel ?? (latestPerformance == null ? "NEW" : null),
                CalculationVersion = latestPerformance?.CalculationVersion,
                CalculatedAt = latestPerformance?.CalculatedAt
            }
        };
    }
}
