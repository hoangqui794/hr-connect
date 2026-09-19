using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.RegisterClient;

public record RegisterClientCommand(
    string Email,
    string Password,
    string FullName,
    string? Phone,
    string CompanyName,
    string? TaxCode = null
) : IRequest<RegisterClientResponse>;
