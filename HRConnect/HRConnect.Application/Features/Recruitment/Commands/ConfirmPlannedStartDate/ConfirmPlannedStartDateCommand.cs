using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmPlannedStartDate;

public record ConfirmPlannedStartDateCommand(
    Guid ApplicationId,
    DateOnly PlannedStartDate,
    string? Reason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<ConfirmPlannedStartDateResponse>;
