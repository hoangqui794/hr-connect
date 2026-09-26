using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationTimeline;

public class RecruitmentApplicationTimelineResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy dòng thời gian ứng tuyển thành công.";

    public RecruitmentApplicationTimelineData Data { get; set; } = new();
}

public class RecruitmentApplicationTimelineData
{
    public Guid ApplicationId { get; set; }

    public string CandidateName { get; set; } = string.Empty;

    public string JobTitle { get; set; } = string.Empty;

    public string CurrentStatus { get; set; } = string.Empty;

    public List<ApplicationTimelineEventDto> Events { get; set; } = new();
}

public class ApplicationTimelineEventDto
{
    public string EventType { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime Timestamp { get; set; }

    public Guid? ActorUserId { get; set; }

    public string? ActorName { get; set; }

    public string? Status { get; set; }
}
