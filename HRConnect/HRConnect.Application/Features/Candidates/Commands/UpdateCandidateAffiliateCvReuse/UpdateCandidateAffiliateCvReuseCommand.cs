using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateAffiliateCvReuse;

public sealed record UpdateCandidateAffiliateCvReuseRequest(
    bool Allowed,
    Guid ConcurrencyToken);

public sealed record UpdateCandidateAffiliateCvReuseCommand(
    Guid UserId,
    Guid CvId,
    bool Allowed,
    Guid ConcurrencyToken) : IRequest<UpdateCandidateAffiliateCvReuseResponse>;

public sealed record UpdateCandidateAffiliateCvReuseResponse(
    bool Success,
    string Message,
    CandidateAffiliateCvReuseData Data);

public sealed record CandidateAffiliateCvReuseData(
    Guid CvId,
    string AffiliateReuseStatus,
    Guid ReuseConcurrencyToken,
    DateTime? ReuseChangedAt);
