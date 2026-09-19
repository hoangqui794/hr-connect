using MediatR;

namespace HRConnect.Application.Features.Companies.Queries.GetCompanyProfile;

public record GetCompanyProfileQuery(Guid UserId) : IRequest<CompanyProfileResponse>;
