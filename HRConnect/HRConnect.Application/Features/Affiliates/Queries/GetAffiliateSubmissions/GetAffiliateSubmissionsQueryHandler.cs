using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissions;

public class GetAffiliateSubmissionsQueryHandler : IRequestHandler<GetAffiliateSubmissionsQuery, AffiliateSubmissionsResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly ISubmissionRepository _submissionRepository;

    public GetAffiliateSubmissionsQueryHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        ISubmissionRepository submissionRepository)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _submissionRepository = submissionRepository;
    }

    public async Task<AffiliateSubmissionsResponse> Handle(GetAffiliateSubmissionsQuery request, CancellationToken cancellationToken)
    {
        // 1. Resolve Affiliate using current authenticated UserId
        var affiliate = await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (affiliate == null)
        {
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");
        }

        // 2. Pagination clamping
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize switch
        {
            < 1 => 20,
            > 100 => 100,
            _ => request.PageSize
        };

        // 3. Query submissions owned by the affiliate
        var (items, totalCount) = await _submissionRepository.GetAffiliateSubmissionsAsync(
            request.UserId,
            request.Status,
            request.JobId,
            request.CandidateId,
            request.FromDate,
            request.ToDate,
            page,
            pageSize,
            cancellationToken);

        // 4. Map DTOs
        var dtos = items.Select(s => new AffiliateSubmissionItemDto
        {
            SubmissionId = s.SubmissionId,
            CandidateId = s.CandidateId,
            CandidateName = s.Candidate?.FullName ?? string.Empty,
            JobId = s.JobId,
            JobTitle = s.Job?.Title ?? string.Empty,
            CvId = s.CvId,
            Status = s.Status,
            ApplicationId = s.Applications.FirstOrDefault()?.ApplicationId,
            AttributionId = s.Attribution?.AttributionId,
            DuplicateOfSubmissionId = s.DuplicateOfSubmissionId,
            Reason = s.Note,
            SubmittedAt = s.SubmittedAt
        }).ToList();

        return new AffiliateSubmissionsResponse
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }
}
