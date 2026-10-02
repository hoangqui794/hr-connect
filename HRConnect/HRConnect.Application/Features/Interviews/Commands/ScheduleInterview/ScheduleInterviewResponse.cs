using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;

public class ScheduleInterviewResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Tạo lịch phỏng vấn thành công.";

    public ScheduleInterviewData Data { get; set; } = new();
}

public class ScheduleInterviewData
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public int InterviewRound { get; set; }

    public string? InterviewType { get; set; }

    public DateTime? ScheduledAt { get; set; }

    public int? DurationMinutes { get; set; }

    public string? Location { get; set; }

    public string? MeetingLink { get; set; }

    public string Status { get; set; } = "SCHEDULED";

    public Guid ConcurrencyToken { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<ScheduleInterviewParticipantDto> Participants { get; set; } = new();
}
