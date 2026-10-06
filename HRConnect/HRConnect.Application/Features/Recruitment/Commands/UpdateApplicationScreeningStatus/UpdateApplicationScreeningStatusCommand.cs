using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;

public record UpdateApplicationScreeningStatusCommand(
    Guid JobId,
    Guid ApplicationId,
    string TargetStatus,
    string? Reason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId
) : IRequest<UpdateApplicationScreeningStatusResponse>;
