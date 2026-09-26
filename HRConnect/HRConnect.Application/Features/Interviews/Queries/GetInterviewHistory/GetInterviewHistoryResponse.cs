using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Interviews.Queries.GetInterviewHistory;

public class GetInterviewHistoryResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy lịch sử trạng thái phỏng vấn thành công.";

    public List<InterviewStatusHistoryItemDto> Data { get; set; } = new();
}

public class InterviewStatusHistoryItemDto
{
    public Guid HistoryId { get; set; }

    public Guid InterviewId { get; set; }

    public string? OldStatus { get; set; }

    public string NewStatus { get; set; } = string.Empty;

    public DateTime? OldScheduledAt { get; set; }

    public DateTime? NewScheduledAt { get; set; }

    public string? Reason { get; set; }

    public Guid? ChangedBy { get; set; }

    public string? ChangedByName { get; set; }

    public DateTime ChangedAt { get; set; }
}
