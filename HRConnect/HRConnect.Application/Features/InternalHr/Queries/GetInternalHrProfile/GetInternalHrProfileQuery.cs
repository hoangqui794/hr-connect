using MediatR;

namespace HRConnect.Application.Features.InternalHr.Queries.GetInternalHrProfile;

public record GetInternalHrProfileQuery(Guid UserId) : IRequest<InternalHrProfileResponse>;
