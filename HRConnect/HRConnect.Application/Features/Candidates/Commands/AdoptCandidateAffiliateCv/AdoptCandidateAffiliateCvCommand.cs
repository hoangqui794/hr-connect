using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.AdoptCandidateAffiliateCv;

public sealed record AdoptCandidateAffiliateCvRequest(string? Title);

public sealed record AdoptCandidateAffiliateCvCommand(Guid UserId, Guid SourceCvId, string? Title)
    : IRequest<AdoptCandidateAffiliateCvResponse>;

public sealed record AdoptCandidateAffiliateCvResponse(
    bool Success,
    string Message,
    CandidateAffiliateCvAdoptionData Data);

public sealed record CandidateAffiliateCvAdoptionData(
    Guid SourceCvId,
    Guid CvId,
    string Title,
    string? FileName,
    bool IsPrimary,
    string Status,
    bool AlreadyAdopted,
    DateTime CreatedAt);
