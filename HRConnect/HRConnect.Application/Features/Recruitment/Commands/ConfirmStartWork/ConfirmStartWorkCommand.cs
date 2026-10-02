using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;

public record ConfirmStartWorkCommand(
    Guid ApplicationId,
    Guid OfferId,
    DateOnly ActualStartDate,
    string? ConfirmationNote,
    string? Position,
    string? Department,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<ConfirmStartWorkResponse>;
