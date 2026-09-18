using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateProfile;

public record GetCandidateProfileQuery(Guid UserId) : IRequest<CandidateProfileResponse>;
