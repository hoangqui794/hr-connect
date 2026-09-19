using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateBankAccount;

public record GetAffiliateBankAccountQuery(Guid UserId) : IRequest<AffiliateBankAccountResponse>;
