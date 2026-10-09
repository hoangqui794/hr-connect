using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.IdentityClaims.GetIdentityClaimDetail;

public sealed record GetIdentityClaimDetailQuery(Guid ClaimId)
    : IRequest<GetIdentityClaimDetailResponse>;

public sealed record IdentityClaimCandidateDetail(
    Guid CandidateId,
    Guid? UserId,
    string FullName,
    string? Email,
    string? Phone,
    string Status,
    Guid? MergedIntoCandidateId,
    int CvCount,
    int SubmissionCount,
    int ApplicationCount,
    int MatchCount,
    bool HasBusinessData);

public sealed record IdentityClaimEmailOwnerDetail(
    Guid EmailIdentityId,
    Guid UserId,
    string PrimaryEmail,
    string DisplayName,
    string Kind,
    string Status);

public sealed record GetIdentityClaimDetailData(
    Guid ClaimId,
    Guid RequesterUserId,
    string RequesterDisplayName,
    string RequesterPrimaryEmail,
    string RequesterUserStatus,
    string AssertedEmail,
    string Status,
    string? ReviewReason,
    DateTime ExpiresAt,
    int AttemptCount,
    int ResendCount,
    DateTime? LastSentAt,
    DateTime? VerifiedAt,
    DateTime? CompletedAt,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid ConcurrencyToken,
    IdentityClaimCandidateDetail RequesterCandidate,
    IdentityClaimCandidateDetail? TargetCandidate,
    IdentityClaimEmailOwnerDetail? CurrentEmailOwner);

public sealed record GetIdentityClaimDetailResponse(
    bool Success,
    GetIdentityClaimDetailData Data);

public sealed class GetIdentityClaimDetailQueryHandler(
    ICandidateIdentityClaimRepository claims)
    : IRequestHandler<GetIdentityClaimDetailQuery, GetIdentityClaimDetailResponse>
{
    public async Task<GetIdentityClaimDetailResponse> Handle(
        GetIdentityClaimDetailQuery request,
        CancellationToken cancellationToken)
    {
        var record = await claims.GetAdminDetailAsync(request.ClaimId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu liên kết danh tính Candidate.");

        return new GetIdentityClaimDetailResponse(
            true,
            new GetIdentityClaimDetailData(
                record.ClaimId,
                record.RequesterUserId,
                record.RequesterDisplayName,
                record.RequesterPrimaryEmail,
                record.RequesterUserStatus,
                record.AssertedEmail,
                record.Status,
                record.ReviewReason,
                record.ExpiresAt,
                record.AttemptCount,
                record.ResendCount,
                record.LastSentAt,
                record.VerifiedAt,
                record.CompletedAt,
                record.ReviewedBy,
                record.ReviewedAt,
                record.CreatedAt,
                record.UpdatedAt,
                record.ConcurrencyToken,
                MapCandidate(record.RequesterCandidate),
                record.TargetCandidate == null ? null : MapCandidate(record.TargetCandidate),
                record.CurrentEmailOwner == null
                    ? null
                    : new IdentityClaimEmailOwnerDetail(
                        record.CurrentEmailOwner.EmailIdentityId,
                        record.CurrentEmailOwner.UserId,
                        record.CurrentEmailOwner.PrimaryEmail,
                        record.CurrentEmailOwner.DisplayName,
                        record.CurrentEmailOwner.Kind,
                        record.CurrentEmailOwner.Status)));
    }

    private static IdentityClaimCandidateDetail MapCandidate(
        AdminIdentityClaimCandidateRecord candidate)
    {
        var hasBusinessData = candidate.CvCount > 0 ||
                              candidate.SubmissionCount > 0 ||
                              candidate.ApplicationCount > 0 ||
                              candidate.MatchCount > 0;
        return new IdentityClaimCandidateDetail(
            candidate.CandidateId,
            candidate.UserId,
            candidate.FullName,
            candidate.Email,
            candidate.Phone,
            candidate.Status,
            candidate.MergedIntoCandidateId,
            candidate.CvCount,
            candidate.SubmissionCount,
            candidate.ApplicationCount,
            candidate.MatchCount,
            hasBusinessData);
    }
}
