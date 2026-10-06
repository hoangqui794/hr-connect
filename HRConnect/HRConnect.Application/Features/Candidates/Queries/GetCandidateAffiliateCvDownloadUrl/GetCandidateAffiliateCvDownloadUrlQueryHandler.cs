using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDownloadUrl;

public sealed class GetCandidateAffiliateCvDownloadUrlQueryHandler
    : IRequestHandler<GetCandidateAffiliateCvDownloadUrlQuery, GetCandidateAffiliateCvDownloadUrlResponse>
{
    private static readonly TimeSpan DownloadUrlLifetime = TimeSpan.FromMinutes(5);

    private readonly ICandidateRepository _candidates;
    private readonly ISubmissionRepository _submissions;
    private readonly ICvStorageService _cvStorage;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public GetCandidateAffiliateCvDownloadUrlQueryHandler(
        ICandidateRepository candidates,
        ISubmissionRepository submissions,
        ICvStorageService cvStorage,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _candidates = candidates;
        _submissions = submissions;
        _cvStorage = cvStorage;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<GetCandidateAffiliateCvDownloadUrlResponse> Handle(
        GetCandidateAffiliateCvDownloadUrlQuery request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.");

        var cv = await _submissions.GetCandidateAffiliateCvDetailAsync(
            candidate.CandidateId, request.CvId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy CV do Affiliate đã nộp cho Candidate này.");

        var download = await _cvStorage.GetCvDownloadUrlAsync(
            cv.CvId, DownloadUrlLifetime, cancellationToken);

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.CandidateAffiliateCvDownloadUrlIssued,
            EntityType = "CANDIDATE_CV",
            EntityId = cv.CvId,
            ActorUserId = request.UserId,
            NewValues = new
            {
                candidate.CandidateId,
                cv.AffiliateUserId,
                cv.DocumentStatus,
                expiresInMinutes = 5,
                download.ExpiresAt
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new GetCandidateAffiliateCvDownloadUrlResponse(
            true,
            new CandidateAffiliateCvDownloadUrlData(
                download.CvId,
                download.FileName,
                download.MimeType,
                download.DownloadUrl,
                download.ExpiresAt));
    }
}
