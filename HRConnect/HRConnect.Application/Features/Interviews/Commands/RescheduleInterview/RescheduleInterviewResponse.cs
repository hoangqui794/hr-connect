using System;

namespace HRConnect.Application.Features.Interviews.Commands.RescheduleInterview;

public class RescheduleInterviewResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Dời lịch phỏng vấn thành công.";

    public RescheduleInterviewData Data { get; set; } = new();
}

public class RescheduleInterviewData
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public int InterviewRound { get; set; }

    public DateTime? OldScheduledAt { get; set; }

    public DateTime NewScheduledAt { get; set; }

    public string Status { get; set; } = "RESCHEDULED";

    public string Reason { get; set; } = string.Empty;

    public Guid ConcurrencyToken { get; set; }

    public DateTime RescheduledAt { get; set; }
}
