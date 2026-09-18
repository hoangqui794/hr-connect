using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Manual/external payout ledger. Rows are never physically deleted. PENDING may become COMPLETED/FAILED/CANCELLED; terminal rows are immutable.
/// </summary>
public partial class Payout
{
    public Guid PayoutId { get; set; }

    public Guid CommissionId { get; set; }

    public decimal Amount { get; set; }

    public DateTime? PayoutDate { get; set; }

    public string? Method { get; set; }

    public string? TransactionReference { get; set; }

    public string? EvidenceUrl { get; set; }

    public string Status { get; set; } = null!;

    public Guid RecordedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int AttemptNo { get; set; }

    public virtual Commission Commission { get; set; } = null!;

    public virtual AppUser RecordedByNavigation { get; set; } = null!;
}

