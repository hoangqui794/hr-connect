using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateReferralProgress;

public sealed class GetAffiliateReferralProgressQueryHandler : IRequestHandler<GetAffiliateReferralProgressQuery, AffiliateReferralProgressResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly ISubmissionRepository _submissionRepository;

    public GetAffiliateReferralProgressQueryHandler(IAffiliateProfileRepository affiliateProfileRepository, ISubmissionRepository submissionRepository)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _submissionRepository = submissionRepository;
    }

    public async Task<AffiliateReferralProgressResponse> Handle(GetAffiliateReferralProgressQuery request, CancellationToken cancellationToken)
    {
        if (await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken) == null)
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize switch { < 1 => 20, > 100 => 100, _ => request.PageSize };
        var (submissions, totalCount) = await _submissionRepository.GetAffiliateSubmissionsAsync(
            request.UserId, null, request.JobId, null, null, null, page, pageSize, cancellationToken);

        return new AffiliateReferralProgressResponse
        {
            Items = submissions.Select(submission =>
            {
                var application = submission.Applications.OrderByDescending(item => item.UpdatedAt).FirstOrDefault();
                return new AffiliateReferralProgressItemDto
                {
                    SubmissionId = submission.SubmissionId,
                    ApplicationId = application?.ApplicationId,
                    CandidateName = submission.Candidate?.FullName ?? string.Empty,
                    JobTitle = submission.Job?.Title ?? string.Empty,
                    CompanyName = submission.Job?.Company?.CompanyName ?? string.Empty,
                    ProgressStatus = ToProgressStatus(submission, application),
                    UpdatedAt = application?.UpdatedAt ?? submission.UpdatedAt
                };
            }).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    private static string ToProgressStatus(Submission submission, JobApplication? application)
    {
        if (application == null)
            return submission.Status switch
            {
                "PENDING_CONSENT" => "WAITING_CONSENT",
                "CONSENT_REJECTED" or "CONSENT_EXPIRED" or "BLOCKED_DUPLICATE" or "JOB_UNAVAILABLE" => "CLOSED",
                _ => "SUBMITTED"
            };

        return application.Status switch
        {
            ApplicationStates.Submitted or ApplicationStates.Screening => "CV_REVIEW",
            ApplicationStates.Shortlisted => "SHORTLISTED",
            ApplicationStates.Interview => "INTERVIEW",
            ApplicationStates.OfferPending or ApplicationStates.OfferAccepted => "OFFER",
            ApplicationStates.Backup => "BACKUP",
            ApplicationStates.Placed => "PLACED",
            ApplicationStates.Rejected or ApplicationStates.BackupNotSelected or ApplicationStates.InterviewFailed or
                ApplicationStates.OfferDeclined or ApplicationStates.NotStarted or ApplicationStates.Withdrawn or
                ApplicationStates.Closed => "CLOSED",
            _ => "SUBMITTED"
        };
    }
}
