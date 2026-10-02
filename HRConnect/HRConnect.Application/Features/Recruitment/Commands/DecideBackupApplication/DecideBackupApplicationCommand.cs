using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.DecideBackupApplication;

public record DecideBackupApplicationCommand(
    Guid ApplicationId,
    string Decision,
    string? Reason,
    string? Note,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<DecideBackupApplicationResponse>;
