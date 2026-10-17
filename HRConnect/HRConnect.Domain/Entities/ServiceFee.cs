using System;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Service fee the Client owes HR Connect: one HEADHUNT_COD placement
/// (offer gross monthly salary × fee multiplier), or the deposit / settlement of a CV_SOURCING job.
/// Payment happens outside the system; Platform Admin records it.
/// </summary>
public partial class ServiceFee
{
    public Guid ServiceFeeId { get; set; }

    /// <summary>Set for a HEADHUNT_COD placement fee (kind PLACEMENT); null for CV_SOURCING fees.</summary>
    public Guid? PlacementId { get; set; }

    /// <summary>The CV_SOURCING job a DEPOSIT, SETTLEMENT or CREDIT belongs to; null for PLACEMENT.</summary>
    public Guid? JobId { get; set; }

    /// <summary>See <c>ServiceFeeKinds</c>.</summary>
    public string Kind { get; set; } = "PLACEMENT";

    public Guid CompanyId { get; set; }

    /// <summary>PLACEMENT: monthly gross salary. CV_SOURCING: the package or counted value the fee is a share of.</summary>
    public decimal BaseSalary { get; set; }

    /// <summary>PLACEMENT: the fee multiplier. DEPOSIT: deposit percent / 100. SETTLEMENT and CREDIT: 1.</summary>
    public decimal FeeMultiplier { get; set; }

    public decimal Amount { get; set; }

    public string CurrencyCode { get; set; } = null!;

    public DateOnly DueDate { get; set; }

    /// <summary>PENDING, DUE, PAID, OVERDUE or CANCELLED.</summary>
    public string Status { get; set; } = null!;

    public DateTime? PaidAt { get; set; }

    public string? PaymentReference { get; set; }

    public Guid? RecordedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Placement? Placement { get; set; }

    public virtual Job? Job { get; set; }

    public virtual Company Company { get; set; } = null!;
}
