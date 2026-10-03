using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.RecordInterviewNoShow;

public record RecordInterviewNoShowCommand(
    Guid InterviewId,
    string Reason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<RecordInterviewNoShowResponse>;
