using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class InterviewStatusHistory
{
    public Guid InterviewStatusHistoryId { get; set; }

    public Guid InterviewId { get; set; }

    public string? OldStatus { get; set; }

    public string NewStatus { get; set; } = null!;

    public DateTime? OldScheduledAt { get; set; }

    public DateTime? NewScheduledAt { get; set; }

    public Guid? ChangedBy { get; set; }

    public string? Reason { get; set; }

    public DateTime ChangedAt { get; set; }

    public virtual AppUser? ChangedByNavigation { get; set; }

    public virtual Interview Interview { get; set; } = null!;
}
