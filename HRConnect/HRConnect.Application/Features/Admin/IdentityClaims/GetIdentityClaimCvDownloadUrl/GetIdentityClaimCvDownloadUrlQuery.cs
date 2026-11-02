using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.IdentityClaims.GetIdentityClaimCvDownloadUrl;

public sealed record GetIdentityClaimCvDownloadUrlQuery(Guid ClaimId, Guid CandidateId)
    : IRequest<GetIdentityClaimCvDownloadUrlResponse>;

public sealed record GetIdentityClaimCvDownloadUrlData(
    Guid CandidateId,
    Guid CvId,
    string FileName,
    string MimeType,
    string DownloadUrl,
    DateTime ExpiresAt);

public sealed record GetIdentityClaimCvDownloadUrlResponse(
    bool Success,
    GetIdentityClaimCvDownloadUrlData Data);

public sealed class GetIdentityClaimCvDownloadUrlQueryHandler(
    ICandidateIdentityClaimRepository claims,
    ICvStorageService cvStorage)
    : IRequestHandler<GetIdentityClaimCvDownloadUrlQuery, GetIdentityClaimCvDownloadUrlResponse>
{
    private static readonly TimeSpan LinkLifetime = TimeSpan.FromMinutes(5);

    public async Task<GetIdentityClaimCvDownloadUrlResponse> Handle(
        GetIdentityClaimCvDownloadUrlQuery request,
        CancellationToken cancellationToken)
    {
        var claim = await claims.GetAdminDetailAsync(request.ClaimId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu liên kết danh tính Candidate.");

        var candidate = claim.RequesterCandidate.CandidateId == request.CandidateId
            ? claim.RequesterCandidate
            : claim.TargetCandidate?.CandidateId == request.CandidateId
                ? claim.TargetCandidate
                : null;

        if (candidate?.PrimaryCvId is not Guid cvId)
            throw new NotFoundException("Hồ sơ Candidate này chưa có CV để đối chiếu.");

        var download = await cvStorage.GetCvDownloadUrlAsync(cvId, LinkLifetime, cancellationToken);

        return new GetIdentityClaimCvDownloadUrlResponse(
            true,
            new GetIdentityClaimCvDownloadUrlData(
                candidate.CandidateId,
                cvId,
                download.FileName,
                download.MimeType,
                download.DownloadUrl,
                download.ExpiresAt));
    }
}
