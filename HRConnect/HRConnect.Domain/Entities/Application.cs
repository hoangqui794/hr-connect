using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Application
{
    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public Guid CandidateId { get; set; }

    public Guid? AcceptedSubmissionId { get; set; }

    /// <summary>
    /// Allowed Application states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.
    /// </summary>
    public string Status { get; set; } = null!;

    public string? CurrentStage { get; set; }

    public DateTime AppliedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? StatusReason { get; set; }

    public string? StatusReasonCode { get; set; }

    public DateOnly? PlannedStartDate { get; set; }

    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public virtual ICollection<AiMatchResult> AiMatchResults { get; set; } = new List<AiMatchResult>();

    public virtual ICollection<ApplicationStatusHistory> ApplicationStatusHistories { get; set; } = new List<ApplicationStatusHistory>();

    public virtual Attribution? Attribution { get; set; }

    public virtual Candidate Candidate { get; set; } = null!;

    public virtual ICollection<Interview> Interviews { get; set; } = new List<Interview>();

    public virtual Job Job { get; set; } = null!;

    /// <summary>MF-05 replacement slot this record belongs to; null for a normal hire.</summary>
    public Guid? ReplacementSlotId { get; set; }

    public virtual ReplacementSlot? ReplacementSlot { get; set; }

    public virtual ICollection<Offer> Offers { get; set; } = new List<Offer>();

    /// <summary>CV_SOURCING: times Internal HR handed this application to the Client (MF-03 C2).</summary>
    public virtual ICollection<SourcingDelivery> SourcingDeliveries { get; set; } = new List<SourcingDelivery>();

    public virtual Placement? Placement { get; set; }

    public virtual PlacementReconciliation? PlacementReconciliation { get; set; }

    public virtual Submission? Submission { get; set; }
}

