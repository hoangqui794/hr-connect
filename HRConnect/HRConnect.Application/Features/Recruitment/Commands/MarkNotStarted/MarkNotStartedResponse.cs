using System;

namespace HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;

public record MarkNotStartedResponse(
    Guid ApplicationId,
    string Status,
    string Reason,
    Guid ConcurrencyToken,
    DateTime UpdatedAt
);
