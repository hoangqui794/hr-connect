using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class ApplicationStatusHistory
{
    public Guid ApplicationStatusHistoryId { get; set; }

    public Guid ApplicationId { get; set; }

    public string? OldStatus { get; set; }

    public string NewStatus { get; set; } = null!;

    public Guid? ChangedBy { get; set; }

    public string? Reason { get; set; }

    public DateTime ChangedAt { get; set; }

    public virtual Application Application { get; set; } = null!;

    public virtual AppUser? ChangedByNavigation { get; set; }
}

