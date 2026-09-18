using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Dispute
{
    public Guid DisputeId { get; set; }

    public string DisputeType { get; set; } = null!;

    public Guid? SubmissionId { get; set; }

    public Guid? AttributionId { get; set; }

    public Guid? CommissionId { get; set; }

    public Guid RaisedBy { get; set; }

    public string Description { get; set; } = null!;

    public string Evidence { get; set; } = null!;

    public string Status { get; set; } = null!;

    public Guid? ResolvedBy { get; set; }

    public string? Resolution { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Attribution? Attribution { get; set; }

    public virtual Commission? Commission { get; set; }

    public virtual AppUser RaisedByNavigation { get; set; } = null!;

    public virtual AppUser? ResolvedByNavigation { get; set; }

    public virtual Submission? Submission { get; set; }
}

