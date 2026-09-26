using System;

namespace HRConnect.Application.Features.Recruitment.Commands.DecideBackupApplication;

public class DecideBackupApplicationResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = string.Empty;
    public DecideBackupApplicationData? Data { get; set; }
}

public class DecideBackupApplicationData
{
    public Guid ApplicationId { get; set; }
    public string PreviousStatus { get; set; } = string.Empty;
    public string CurrentStatus { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public Guid DecidedBy { get; set; }
    public DateTime DecidedAt { get; set; }
    public Guid ConcurrencyToken { get; set; }
}
