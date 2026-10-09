using System;
using System.Collections.Generic;
using HRConnect.Application.Features.Finance.Common;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;

public record ConfirmStartWorkResponse(
    Guid ApplicationId,
    string ApplicationStatus,
    Guid PlacementId,
    DateOnly ActualStartDate,
    Guid ConcurrencyToken,
    IReadOnlyList<string> AllowedActions,
    // MF-05 records created for a HEADHUNT_COD placement; null for other service types.
    PlacementFinanceResult? Finance = null
);
