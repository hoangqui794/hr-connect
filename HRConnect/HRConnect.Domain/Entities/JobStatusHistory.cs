using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class JobStatusHistory
{
    public Guid JobStatusHistoryId { get; set; }

    public Guid JobId { get; set; }

    public string? OldStatus { get; set; }

    public string NewStatus { get; set; } = null!;

    public Guid? ChangedBy { get; set; }

    public string? Reason { get; set; }

    public DateTime ChangedAt { get; set; }

    public virtual AppUser? ChangedByNavigation { get; set; }

    public virtual Job Job { get; set; } = null!;
}

