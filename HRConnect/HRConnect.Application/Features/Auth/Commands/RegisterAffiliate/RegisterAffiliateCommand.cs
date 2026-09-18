using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.RegisterAffiliate;

public record RegisterAffiliateCommand(
    string Email,
    string Password,
    string FullName,
    string? Phone = null
) : IRequest<RegisterAffiliateResponse>;
