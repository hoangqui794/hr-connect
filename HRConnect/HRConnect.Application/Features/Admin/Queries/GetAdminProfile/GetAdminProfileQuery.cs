using MediatR;

namespace HRConnect.Application.Features.Admin.Queries.GetAdminProfile;

public record GetAdminProfileQuery(Guid UserId) : IRequest<AdminProfileResponse>;
