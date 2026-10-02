using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;

public sealed class GetSubmissionConsentQueryHandler : IRequestHandler<GetSubmissionConsentQuery, SubmissionConsentReviewResponse>
{
    private readonly ISubmissionConsentRepository _repository;
    private readonly ICvStorageService _cvStorage;
    private readonly IUnitOfWork _unitOfWork;

    public GetSubmissionConsentQueryHandler(
        ISubmissionConsentRepository repository,
        ICvStorageService cvStorage,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _cvStorage = cvStorage;
        _unitOfWork = unitOfWork;
    }

    public async Task<SubmissionConsentReviewResponse> Handle(GetSubmissionConsentQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            throw new BadRequestException("Liên kết xác nhận không hợp lệ.");

        var consent = await _repository.GetByTokenHashAsync(SubmissionConsentToken.Hash(request.Token), cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hoặc liên kết không hợp lệ.");

        EnsureIdentity(consent.Submission.Candidate.UserId, request.RequesterUserId);
        await ExpireIfNeededAsync(consent, cancellationToken);

        string? url = null;
        DateTime? urlExpiresAt = null;
        if (consent.Status == "PENDING")
        {
            var download = await _cvStorage.GetCvDownloadUrlAsync(
                consent.Submission.CvId, TimeSpan.FromMinutes(5), cancellationToken);
            url = download.DownloadUrl;
            urlExpiresAt = download.ExpiresAt;
        }

        return new SubmissionConsentReviewResponse
        {
            Data = new SubmissionConsentReviewData
            {
                SubmissionId = consent.SubmissionId,
                Status = consent.Status,
                ExpiresAt = consent.ExpiresAt,
                CandidateName = consent.Submission.Candidate.FullName,
                JobTitle = consent.Submission.Job.Title,
                CompanyName = consent.Submission.Job.Company.CompanyName,
                CvFileName = consent.Submission.CandidateCv.FileName ?? "candidate-cv.pdf",
                CvDownloadUrl = url,
                CvUrlExpiresAt = urlExpiresAt
            }
        };
    }

    private static void EnsureIdentity(Guid? candidateUserId, Guid? requesterUserId)
    {
        if (candidateUserId.HasValue && requesterUserId != candidateUserId)
            throw new ForbiddenException("Vui lòng đăng nhập đúng tài khoản Candidate để xem và xác nhận hồ sơ.");
    }

    private async Task ExpireIfNeededAsync(HRConnect.Domain.Entities.SubmissionConsent consent, CancellationToken cancellationToken)
    {
        if (consent.Status != "PENDING" || consent.ExpiresAt > DateTime.UtcNow) return;
        var now = DateTime.UtcNow;
        consent.Status = "EXPIRED";
        consent.UpdatedAt = now;
        consent.Submission.Status = "CONSENT_EXPIRED";
        consent.Submission.UpdatedAt = now;
        if (consent.Submission.CandidateCv.Status == "PENDING_CONSENT")
        {
            consent.Submission.CandidateCv.Status = "CONSENT_EXPIRED";
            consent.Submission.CandidateCv.UpdatedAt = now;
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
