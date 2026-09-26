using System;
using System.Collections.Generic;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;

namespace HRConnect.Application.Features.Interviews.Commands.UpdateInterview;

public class UpdateInterviewResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Cập nhật lịch phỏng vấn thành công.";

    public UpdateInterviewData Data { get; set; } = new();
}

public class UpdateInterviewData
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public int InterviewRound { get; set; }

    public string? InterviewType { get; set; }

    public DateTime? ScheduledAt { get; set; }

    public int? DurationMinutes { get; set; }

    public string? Location { get; set; }

    public string? MeetingLink { get; set; }

    public string Status { get; set; } = string.Empty;

    public Guid ConcurrencyToken { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<ScheduleInterviewParticipantDto> Participants { get; set; } = new();
}
