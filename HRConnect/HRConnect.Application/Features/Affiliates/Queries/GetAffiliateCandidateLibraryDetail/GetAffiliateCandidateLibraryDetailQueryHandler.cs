using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibraryDetail;

public sealed class GetAffiliateCandidateLibraryDetailQueryHandler
    : IRequestHandler<GetAffiliateCandidateLibraryDetailQuery, GetAffiliateCandidateLibraryDetailResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfiles;
    private readonly ISubmissionRepository _submissions;

    public GetAffiliateCandidateLibraryDetailQueryHandler(
        IAffiliateProfileRepository affiliateProfiles,
        ISubmissionRepository submissions)
    {
        _affiliateProfiles = affiliateProfiles;
        _submissions = submissions;
    }

    public async Task<GetAffiliateCandidateLibraryDetailResponse> Handle(
        GetAffiliateCandidateLibraryDetailQuery request,
        CancellationToken cancellationToken)
    {
        if (await _affiliateProfiles.GetByUserIdAsync(request.UserId, cancellationToken) == null)
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");

        var candidate = await _submissions.GetAffiliateCandidateLibraryDetailAsync(
            request.UserId, request.CandidateId, cancellationToken);
        if (candidate == null)
            throw new NotFoundException("Không tìm thấy Candidate trong kho của Affiliate.");

        return new GetAffiliateCandidateLibraryDetailResponse
        {
            Data = new AffiliateCandidateLibraryDetailDto(
                candidate.CandidateId,
                candidate.FullName,
                candidate.Email,
                candidate.Phone,
                candidate.HasAccount,
                candidate.AcceptedSubmissionCount,
                candidate.Cvs.Select(cv => new AffiliateCandidateCvDto(
                    cv.CvId,
                    cv.Title,
                    cv.FileName,
                    cv.MimeType,
                    cv.FileSizeBytes,
                    cv.Status,
                    cv.CreatedAt,
                    cv.AcceptedSubmissionCount,
                    cv.LastUsedAt)).ToList())
        };
    }
}
