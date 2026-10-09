using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.GetCandidateEmailIdentities;

public sealed class GetCandidateEmailIdentitiesQueryHandler
    : IRequestHandler<GetCandidateEmailIdentitiesQuery, GetCandidateEmailIdentitiesResponse>
{
    private readonly ICandidateRepository _candidates;
    private readonly IUserEmailIdentityRepository _emailIdentities;

    public GetCandidateEmailIdentitiesQueryHandler(
        ICandidateRepository candidates,
        IUserEmailIdentityRepository emailIdentities)
    {
        _candidates = candidates;
        _emailIdentities = emailIdentities;
    }

    public async Task<GetCandidateEmailIdentitiesResponse> Handle(
        GetCandidateEmailIdentitiesQuery request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");

        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
        {
            throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.");
        }

        var identities = await _emailIdentities.GetByUserIdAsync(request.UserId, cancellationToken);
        if (!identities.Any(identity =>
                identity.Kind == "PRIMARY" && identity.Status != "REVOKED"))
        {
            throw new ConflictException(
                "Tài khoản chưa có email chính hợp lệ. Vui lòng liên hệ bộ phận hỗ trợ.",
                "PRIMARY_EMAIL_IDENTITY_MISSING");
        }

        var items = identities.Select(identity => new CandidateEmailIdentityItem(
            identity.EmailIdentityId,
            identity.Email,
            identity.Kind,
            identity.Status,
            identity.VerificationSource,
            identity.VerifiedAt,
            identity.RevokedAt,
            identity.CreatedAt,
            identity.ConcurrencyToken,
            identity.Kind == "ALIAS" && identity.Status == "VERIFIED",
            identity.Kind == "ALIAS" && identity.Status == "VERIFIED")).ToList();

        return new GetCandidateEmailIdentitiesResponse(
            true,
            "Lấy danh sách email của tài khoản thành công.",
            new CandidateEmailIdentitiesData(items));
    }
}
