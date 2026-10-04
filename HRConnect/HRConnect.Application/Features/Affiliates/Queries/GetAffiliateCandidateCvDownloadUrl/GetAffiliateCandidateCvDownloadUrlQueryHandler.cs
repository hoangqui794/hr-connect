using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateCvDownloadUrl;

public sealed class GetAffiliateCandidateCvDownloadUrlQueryHandler
    : IRequestHandler<GetAffiliateCandidateCvDownloadUrlQuery, GetAffiliateCandidateCvDownloadUrlResponse>
{
    private static readonly TimeSpan DownloadUrlLifetime = TimeSpan.FromMinutes(5);

    private readonly IAffiliateProfileRepository _affiliateProfiles;
    private readonly ISubmissionRepository _submissions;
    private readonly ICvStorageService _cvStorage;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public GetAffiliateCandidateCvDownloadUrlQueryHandler(
        IAffiliateProfileRepository affiliateProfiles,
        ISubmissionRepository submissions,
        ICvStorageService cvStorage,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _affiliateProfiles = affiliateProfiles;
        _submissions = submissions;
        _cvStorage = cvStorage;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<GetAffiliateCandidateCvDownloadUrlResponse> Handle(
        GetAffiliateCandidateCvDownloadUrlQuery request,
        CancellationToken cancellationToken)
    {
        if (await _affiliateProfiles.GetByUserIdAsync(request.UserId, cancellationToken) == null)
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");

        var cv = await _submissions.GetAffiliateCandidateCvAccessAsync(
            request.UserId, request.CandidateId, request.CvId, cancellationToken);
        if (cv == null)
            throw new NotFoundException("Không tìm thấy CV trong kho của Affiliate.");

        var download = await _cvStorage.GetCvDownloadUrlAsync(
            cv.CvId, DownloadUrlLifetime, cancellationToken);

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.AffiliateCvViewed,
            EntityType = "CANDIDATE_CV",
            EntityId = cv.CvId,
            ActorUserId = request.UserId,
            NewValues = new { cv.CandidateId, expiresInMinutes = 5 }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new GetAffiliateCandidateCvDownloadUrlResponse
        {
            Data = new AffiliateCandidateCvDownloadUrlDto(
                download.CvId,
                download.FileName,
                download.MimeType,
                download.DownloadUrl,
                download.ExpiresAt)
        };
    }
}
