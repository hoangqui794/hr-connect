namespace HRConnect.Application.Features.Interviews.Commands.ConfirmInterviewAttendance;

public record ConfirmInterviewAttendanceResponse(
    Guid InterviewId,
    Guid ApplicationId,
    string AttendanceStatus,
    DateTime RespondedAt,
    bool AlreadyConfirmed
);
