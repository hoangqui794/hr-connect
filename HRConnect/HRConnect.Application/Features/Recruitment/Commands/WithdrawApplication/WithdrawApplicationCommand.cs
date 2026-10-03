using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.WithdrawApplication;

public record WithdrawApplicationCommand(
    Guid ApplicationId,
    string? Reason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId) : IRequest<WithdrawApplicationResponse>;
