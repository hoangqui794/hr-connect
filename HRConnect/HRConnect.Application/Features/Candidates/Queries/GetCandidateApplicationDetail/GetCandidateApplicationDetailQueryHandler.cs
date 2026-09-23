using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateApplicationDetail;

public class GetCandidateApplicationDetailQueryHandler : IRequestHandler<GetCandidateApplicationDetailQuery, CandidateApplicationDetailResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IApplicationRepository _applicationRepository;

    public GetCandidateApplicationDetailQueryHandler(
        ICandidateRepository candidateRepository,
        IApplicationRepository applicationRepository)
    {
        _candidateRepository = candidateRepository;
        _applicationRepository = applicationRepository;
    }

    public async Task<CandidateApplicationDetailResponse> Handle(GetCandidateApplicationDetailQuery request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng viên.");
        }

        var application = await _applicationRepository.GetByIdWithDetailsAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đơn ứng tuyển.");
        }

        // Enforce ownership: Candidate must own the Application
        if (application.CandidateId != candidate.CandidateId)
        {
            throw new ForbiddenException("Bạn không có quyền truy cập thông tin ứng tuyển này.");
        }

        var latestAi = application.AiMatchResults?
            .OrderByDescending(x => x.AttemptNo)
            .FirstOrDefault();

        return new CandidateApplicationDetailResponse
        {
            ApplicationId = application.ApplicationId,
            CandidateId = application.CandidateId,
            JobId = application.JobId,
            JobTitle = application.Job?.Title ?? string.Empty,
            CompanyId = application.Job?.CompanyId,
            CompanyName = application.Job?.Company?.CompanyName ?? string.Empty,
            CvId = application.Submission?.CvId,
            CvTitle = application.Submission?.CandidateCv?.Title,
            CvFileName = application.Submission?.CandidateCv?.FileName,
            Status = application.Status,
            CurrentStage = application.CurrentStage,
            StatusReason = application.StatusReason,
            SubmissionSource = application.Submission?.Source,
            AppliedAt = application.AppliedAt,
            UpdatedAt = application.UpdatedAt,
            AiStatus = latestAi?.Status,
            AiMatchScore = latestAi?.MatchScore,
            AiMatchTier = latestAi?.MatchTier
        };
    }
}
