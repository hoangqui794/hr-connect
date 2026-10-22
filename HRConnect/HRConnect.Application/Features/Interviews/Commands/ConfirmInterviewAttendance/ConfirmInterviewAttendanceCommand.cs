using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.ConfirmInterviewAttendance;

public record ConfirmInterviewAttendanceCommand(
    Guid InterviewId,
    Guid CurrentUserId
) : IRequest<ConfirmInterviewAttendanceResponse>;
