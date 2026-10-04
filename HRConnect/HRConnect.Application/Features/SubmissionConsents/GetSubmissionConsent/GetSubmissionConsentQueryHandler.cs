using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.SubmissionConsents.Common;
using MediatR;

namespace HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;

public sealed class GetSubmissionConsentQueryHandler : IRequestHandler<GetSubmissionConsentQuery, SubmissionConsentReviewResponse>
{
    private readonly ISubmissionConsentRepository _repository;
    private readonly ICvStorageService _cvStorage;
    private readonly ISubmissionConsentExpiryService _expiryService;

    public GetSubmissionConsentQueryHandler(
        ISubmissionConsentRepository repository,
        ICvStorageService cvStorage,
        ISubmissionConsentExpiryService expiryService)
    {
        _repository = repository;
        _cvStorage = cvStorage;
        _expiryService = expiryService;
    }

    public async Task<SubmissionConsentReviewResponse> Handle(GetSubmissionConsentQuery request, CancellationToken cancellationToken)
    {
        var consent = await ResolveConsentAsync(request, cancellationToken);
        await _expiryService.ExpireAsync(
            consent,
            DateTime.UtcNow,
            request.RequesterUserId,
            "CONSENT_REVIEW",
            cancellationToken);

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

    private async Task<HRConnect.Domain.Entities.SubmissionConsent> ResolveConsentAsync(
        GetSubmissionConsentQuery request,
        CancellationToken cancellationToken)
    {
        if (request.SubmissionId.HasValue)
        {
            if (!request.RequesterUserId.HasValue)
                throw new ForbiddenException("Vui lòng đăng nhập tài khoản Candidate để xem yêu cầu xác nhận.");

            var consent = await _repository.GetBySubmissionIdAsync(request.SubmissionId.Value, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hồ sơ.");
            if (consent.Submission.Candidate.UserId != request.RequesterUserId)
                throw new ForbiddenException("Bạn không có quyền xem yêu cầu xác nhận của Candidate khác.");
            return consent;
        }

        if (string.IsNullOrWhiteSpace(request.Token))
            throw new BadRequestException("Liên kết xác nhận không hợp lệ.");

        var tokenConsent = await _repository.GetByTokenHashAsync(
            SubmissionConsentToken.Hash(request.Token), cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hoặc liên kết không hợp lệ.");
        EnsureIdentity(tokenConsent.Submission.Candidate.UserId, request.RequesterUserId);
        return tokenConsent;
    }

    private static void EnsureIdentity(Guid? candidateUserId, Guid? requesterUserId)
    {
        if (candidateUserId.HasValue && requesterUserId != candidateUserId)
            throw new ForbiddenException("Vui lòng đăng nhập đúng tài khoản Candidate để xem và xác nhận hồ sơ.");
    }

}
