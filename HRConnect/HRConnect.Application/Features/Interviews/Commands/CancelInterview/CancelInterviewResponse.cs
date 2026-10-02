using System;

namespace HRConnect.Application.Features.Interviews.Commands.CancelInterview;

public class CancelInterviewResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Hủy lịch phỏng vấn thành công.";

    public CancelInterviewData Data { get; set; } = new();
}

public class CancelInterviewData
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public int InterviewRound { get; set; }

    public string Status { get; set; } = "CANCELLED";

    public string Reason { get; set; } = string.Empty;

    public Guid ConcurrencyToken { get; set; }

    public DateTime CancelledAt { get; set; }
}
