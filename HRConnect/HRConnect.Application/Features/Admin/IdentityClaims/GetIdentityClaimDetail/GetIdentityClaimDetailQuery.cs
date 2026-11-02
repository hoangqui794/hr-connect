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
    int SkillCount,
    string? HighestEducation,
    decimal? YearsOfExperience,
    string? CurrentJobTitle,
    string? Summary,
    DateOnly? DateOfBirth,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid? PrimaryCvId,
    string? PrimaryCvTitle,
    string? PrimaryCvFileName,
    bool HasBusinessData);

public sealed record IdentityClaimEvidenceDetail(
    bool EmailOwnershipVerified,
    bool SameFullName,
    bool SamePhone,
    bool SameDateOfBirth,
    bool ExactCvMatch,
    bool SimilarCvText,
    int SupportingSignalCount,
    int ConflictingSignalCount);

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
    Guid? DuplicateCaseId,
    IdentityClaimCandidateDetail RequesterCandidate,
    IdentityClaimCandidateDetail? TargetCandidate,
    IdentityClaimEmailOwnerDetail? CurrentEmailOwner,
    IdentityClaimEvidenceDetail Evidence);

public sealed record GetIdentityClaimDetailResponse(
    bool Success,
    GetIdentityClaimDetailData Data);

public sealed class GetIdentityClaimDetailQueryHandler(
    ICandidateIdentityClaimRepository claims,
    ICandidateDuplicateRepository duplicates)
    : IRequestHandler<GetIdentityClaimDetailQuery, GetIdentityClaimDetailResponse>
{
    public async Task<GetIdentityClaimDetailResponse> Handle(
        GetIdentityClaimDetailQuery request,
        CancellationToken cancellationToken)
    {
        var record = await claims.GetAdminDetailAsync(request.ClaimId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu liên kết danh tính Candidate.");

        var duplicateCaseId = record.TargetCandidate == null
            ? null
            : await duplicates.FindIdentityClaimCaseIdAsync(
                record.RequesterCandidate.CandidateId,
                record.TargetCandidate.CandidateId,
                cancellationToken);
        var evidence = BuildEvidence(record);

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
                duplicateCaseId,
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
                        record.CurrentEmailOwner.Status),
                evidence));
    }

    private static IdentityClaimCandidateDetail MapCandidate(
        AdminIdentityClaimCandidateRecord candidate)
    {
        var hasBusinessData = candidate.CvCount > 0 ||
                              candidate.SubmissionCount > 0 ||
                              candidate.ApplicationCount > 0 ||
                              candidate.MatchCount > 0 ||
                              candidate.SkillCount > 0;
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
            candidate.SkillCount,
            candidate.HighestEducation,
            candidate.YearsOfExperience,
            candidate.CurrentJobTitle,
            candidate.Summary,
            candidate.DateOfBirth,
            candidate.CreatedAt,
            candidate.UpdatedAt,
            candidate.PrimaryCvId,
            candidate.PrimaryCvTitle,
            candidate.PrimaryCvFileName,
            hasBusinessData);
    }

    private static IdentityClaimEvidenceDetail BuildEvidence(AdminIdentityClaimDetailRecord record)
    {
        var target = record.TargetCandidate;
        if (target == null)
            return new IdentityClaimEvidenceDetail(true, false, false, false, false, false, 1, 0);

        var sameFullName = string.Equals(record.RequesterCandidate.FullName.Trim(), target.FullName.Trim(),
            StringComparison.OrdinalIgnoreCase);
        var samePhone = !string.IsNullOrWhiteSpace(record.RequesterCandidate.NormalizedPhone) &&
                        string.Equals(record.RequesterCandidate.NormalizedPhone, target.NormalizedPhone,
                            StringComparison.Ordinal);
        var sameDateOfBirth = record.RequesterCandidate.DateOfBirth.HasValue &&
                              record.RequesterCandidate.DateOfBirth == target.DateOfBirth;
        var exactCv = record.HasExactCvMatch;
        var similarCv = record.HasTextFingerprintMatch;
        var supporting = 1 + Convert.ToInt32(sameFullName) + Convert.ToInt32(samePhone) + Convert.ToInt32(sameDateOfBirth) +
                         Convert.ToInt32(exactCv) + Convert.ToInt32(similarCv);
        var conflicts = Convert.ToInt32(!sameFullName) +
                        Convert.ToInt32(!string.IsNullOrWhiteSpace(record.RequesterCandidate.NormalizedPhone) &&
                            !string.IsNullOrWhiteSpace(target.NormalizedPhone) && !samePhone) +
                        Convert.ToInt32(record.RequesterCandidate.DateOfBirth.HasValue &&
                            target.DateOfBirth.HasValue && !sameDateOfBirth);

        return new IdentityClaimEvidenceDetail(true, sameFullName, samePhone, sameDateOfBirth, exactCv, similarCv,
            supporting, conflicts);
    }
}
