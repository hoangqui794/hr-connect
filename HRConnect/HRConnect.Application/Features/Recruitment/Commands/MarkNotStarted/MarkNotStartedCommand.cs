using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;

public record MarkNotStartedCommand(
    Guid ApplicationId,
    string Reason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<MarkNotStartedResponse>;
