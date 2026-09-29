using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;

public record ConfirmStartWorkResponse(
    Guid ApplicationId,
    string ApplicationStatus,
    Guid PlacementId,
    DateOnly ActualStartDate,
    Guid ConcurrencyToken,
    IReadOnlyList<string> AllowedActions
);
