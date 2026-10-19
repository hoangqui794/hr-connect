namespace HRConnect.Domain.Entities;

/// <summary>
/// MF-05: one free replacement hire granted when a HEADHUNT_COD placement leaves during warranty.
/// One slot per placement and per service fee (only one replacement per fee). It opens only once the
/// Client has paid the fee and expires after <see cref="FillWindowDays"/>.
/// Design: docs/main-flows.md (MF-05, suất thay thế).
/// </summary>
public partial class ReplacementSlot
{
    public Guid ReplacementSlotId { get; set; }

    public Guid JobId { get; set; }

    /// <summary>The placement whose candidate left.</summary>
    public Guid OriginalPlacementId { get; set; }

    /// <summary>The fee the replacement is free under.</summary>
    public Guid ServiceFeeId { get; set; }

    /// <summary>WAITING_PAYMENT, OPEN, FILLED, CANCELLED or EXPIRED.</summary>
    public string Status { get; set; } = null!;

    /// <summary>mf05.replacement.fill_window_days at the time the slot was created.</summary>
    public int FillWindowDays { get; set; }

    public DateTime? OpenedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public Guid? FilledByPlacementId { get; set; }

    public DateTime? ClosedAt { get; set; }

    public Guid? ClosedBy { get; set; }

    public string? CancelReason { get; set; }

    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public Guid? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Job Job { get; set; } = null!;

    public virtual Placement OriginalPlacement { get; set; } = null!;

    public virtual ServiceFee ServiceFee { get; set; } = null!;

    public virtual Placement? FilledByPlacement { get; set; }
}
