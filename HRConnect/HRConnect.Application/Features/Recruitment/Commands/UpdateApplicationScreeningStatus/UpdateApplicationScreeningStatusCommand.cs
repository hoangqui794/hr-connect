using HRConnect.Application.Features.Recruitment.Common;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;

public record UpdateApplicationScreeningStatusCommand(
    Guid JobId,
    Guid ApplicationId,
    string TargetStatus,
    string? Reason,
    string? ReasonCode,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    ScreeningActor Actor
) : IRequest<UpdateApplicationScreeningStatusResponse>;
