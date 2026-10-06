using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Interviews.Queries.GetInterviewDetail;

public class GetInterviewDetailResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy chi tiết lịch phỏng vấn thành công.";

    public InterviewDetailData Data { get; set; } = new();
}

public class InterviewDetailData
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public Guid CandidateId { get; set; }

    public string CandidateFullName { get; set; } = string.Empty;

    public string? CandidateEmail { get; set; }

    public string? CandidatePhone { get; set; }

    public int InterviewRound { get; set; }

    public string? InterviewType { get; set; }

    public DateTime? ScheduledAt { get; set; }

    public int? DurationMinutes { get; set; }

    public string? Location { get; set; }

    public string? MeetingLink { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Result { get; set; }

    public string? Feedback { get; set; }

    public Guid? CreatedBy { get; set; }

    public string? CreatedByName { get; set; }

    public Guid? RecordedBy { get; set; }

    public string? RecordedByName { get; set; }

    public DateTime? RecordedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public List<InterviewParticipantDetailDto> Participants { get; set; } = new();

    public List<InterviewStatusHistoryDetailDto> StatusHistories { get; set; } = new();
}

public class InterviewParticipantDetailDto
{
    public Guid UserId { get; set; }

    public string? Name { get; set; }

    public string Role { get; set; } = string.Empty;
}

public class InterviewStatusHistoryDetailDto
{
    public Guid InterviewStatusHistoryId { get; set; }

    public string? OldStatus { get; set; }

    public string NewStatus { get; set; } = string.Empty;

    public DateTime? OldScheduledAt { get; set; }

    public DateTime? NewScheduledAt { get; set; }

    public Guid? ChangedBy { get; set; }

    public string? ChangedByName { get; set; }

    public string? Reason { get; set; }

    public DateTime ChangedAt { get; set; }
}
