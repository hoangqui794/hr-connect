namespace HRConnect.Application.Features.Interviews.Commands.RecordInterviewNoShow;

public record RecordInterviewNoShowResponse(
    Guid InterviewId,
    Guid ApplicationId,
    string Status,
    string Reason,
    Guid ConcurrencyToken,
    DateTime RecordedAt);
