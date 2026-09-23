using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissionDetail;

public class GetAffiliateSubmissionDetailQueryHandler : IRequestHandler<GetAffiliateSubmissionDetailQuery, AffiliateSubmissionDetailResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly ISubmissionRepository _submissionRepository;

    public GetAffiliateSubmissionDetailQueryHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        ISubmissionRepository submissionRepository)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _submissionRepository = submissionRepository;
    }

    public async Task<AffiliateSubmissionDetailResponse> Handle(GetAffiliateSubmissionDetailQuery request, CancellationToken cancellationToken)
    {
        // 1. Resolve Affiliate profile by UserId
        var affiliate = await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (affiliate == null)
        {
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");
        }

        // 2. Fetch submission with details
        var submission = await _submissionRepository.GetByIdWithDetailsAsync(request.SubmissionId, cancellationToken);
        if (submission == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin lượt nộp ứng viên.");
        }

        // 3. Enforce ownership: submission must be submitted by this user
        if (submission.SubmittedBy != request.UserId)
        {
            throw new ForbiddenException("Bạn không có quyền truy cập thông tin lượt nộp ứng viên này.");
        }

        // 4. Map DTO
        return new AffiliateSubmissionDetailResponse
        {
            SubmissionId = submission.SubmissionId,
            Status = submission.Status,
            CandidateId = submission.CandidateId,
            CandidateName = submission.Candidate?.FullName ?? string.Empty,
            CandidateEmail = submission.Candidate?.Email,
            CandidatePhone = submission.Candidate?.Phone,
            JobId = submission.JobId,
            JobTitle = submission.Job?.Title ?? string.Empty,
            CompanyName = submission.Job?.Company?.CompanyName ?? string.Empty,
            CvId = submission.CvId,
            CvTitle = submission.CandidateCv?.Title,
            CvFileName = submission.CandidateCv?.FileName,
            Reason = submission.Note,
            DuplicateOfSubmissionId = submission.DuplicateOfSubmissionId,
            ApplicationId = submission.Applications.FirstOrDefault()?.ApplicationId,
            AttributionId = submission.Attribution?.AttributionId,
            SubmittedAt = submission.SubmittedAt,
            UpdatedAt = submission.UpdatedAt
        };
    }
}
