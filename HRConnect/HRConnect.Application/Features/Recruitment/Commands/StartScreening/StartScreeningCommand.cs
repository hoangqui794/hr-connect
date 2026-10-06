using HRConnect.Application.Features.Recruitment.Common;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.StartScreening;

/// <summary>
/// Sent by the screener's UI when an application is opened (MF-03). Idempotent: moves
/// SUBMITTED to SCREENING only for the screener ScreeningPolicy assigns; otherwise a no-op.
/// </summary>
public record StartScreeningCommand(
    Guid JobId,
    Guid ApplicationId,
    Guid CurrentUserId,
    ScreeningActor Actor
) : IRequest<StartScreeningResponse>;
