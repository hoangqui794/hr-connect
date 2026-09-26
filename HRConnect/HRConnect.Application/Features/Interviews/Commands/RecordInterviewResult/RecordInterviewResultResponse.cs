using System;

namespace HRConnect.Application.Features.Interviews.Commands.RecordInterviewResult;

public class RecordInterviewResultResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Ghi nhận kết quả phỏng vấn thành công.";

    public RecordInterviewResultData Data { get; set; } = new();
}

public class RecordInterviewResultData
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public int InterviewRound { get; set; }

    public string Status { get; set; } = "COMPLETED";

    public string Result { get; set; } = string.Empty;

    public string? Feedback { get; set; }

    public string? ApplicationStatus { get; set; }

    public Guid? RecordedBy { get; set; }

    public DateTime? RecordedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }
}
