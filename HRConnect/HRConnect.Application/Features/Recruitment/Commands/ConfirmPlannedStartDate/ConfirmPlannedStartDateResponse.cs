using System;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmPlannedStartDate;

public record ConfirmPlannedStartDateResponse(
    Guid ApplicationId,
    DateOnly PlannedStartDate,
    string Status,
    string? StatusReason,
    Guid ConcurrencyToken,
    DateTime UpdatedAt
);
