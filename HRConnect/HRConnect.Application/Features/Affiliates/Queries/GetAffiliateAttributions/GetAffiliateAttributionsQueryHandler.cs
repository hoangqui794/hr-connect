using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateAttributions;

public class GetAffiliateAttributionsQueryHandler : IRequestHandler<GetAffiliateAttributionsQuery, AffiliateAttributionsResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly IAttributionRepository _attributionRepository;

    public GetAffiliateAttributionsQueryHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        IAttributionRepository attributionRepository)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _attributionRepository = attributionRepository;
    }

    public async Task<AffiliateAttributionsResponse> Handle(GetAffiliateAttributionsQuery request, CancellationToken cancellationToken)
    {
        // 1. Resolve AffiliateProfile by UserId
        var affiliate = await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (affiliate == null)
        {
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");
        }

        // 2. Clamp pagination
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize switch
        {
            < 1 => 20,
            > 100 => 100,
            _ => request.PageSize
        };

        // 3. Query attributions owned by this AffiliateId
        var (items, totalCount) = await _attributionRepository.GetAffiliateAttributionsAsync(
            affiliate.AffiliateId,
            request.JobId,
            request.CandidateId,
            request.FromDate,
            request.ToDate,
            page,
            pageSize,
            cancellationToken);

        // 4. Map DTOs
        var dtos = items.Select(a => new AffiliateAttributionItemDto
        {
            AttributionId = a.AttributionId,
            ApplicationId = a.ApplicationId,
            CandidateId = a.Application?.CandidateId ?? a.WinningSubmission?.CandidateId ?? Guid.Empty,
            CandidateName = a.Application?.Candidate?.FullName ?? string.Empty,
            JobId = a.Application?.JobId ?? a.WinningSubmission?.JobId ?? Guid.Empty,
            JobTitle = a.Application?.Job?.Title ?? string.Empty,
            CvId = a.WinningSubmission?.CvId ?? Guid.Empty,
            AttributionRule = a.AttributionRule,
            Status = a.Status,
            EstablishedAt = a.EstablishedAt,
            UpdatedAt = a.UpdatedAt
        }).ToList();

        return new AffiliateAttributionsResponse
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }
}
