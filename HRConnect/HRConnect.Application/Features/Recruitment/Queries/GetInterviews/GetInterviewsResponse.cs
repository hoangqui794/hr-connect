using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Recruitment.Queries.GetInterviews;

public class GetInterviewsResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy danh sách lịch phỏng vấn thành công.";

    public GetInterviewsData Data { get; set; } = new();
}

public class GetInterviewsData
{
    public List<InterviewItemDto> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int Total { get; set; }

    public int TotalPages { get; set; }
}

public class InterviewItemDto
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public Guid CandidateId { get; set; }

    public string CandidateName { get; set; } = string.Empty;

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

    public List<InterviewParticipantDto> Participants { get; set; } = new();

    public DateTime CreatedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }
}

public class InterviewParticipantDto
{
    public Guid UserId { get; set; }

    public string? Name { get; set; }

    public string? Role { get; set; }
}
