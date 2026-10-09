using System;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Service fee the Client owes HR Connect for one HEADHUNT_COD placement
/// (offer gross monthly salary × fee multiplier). Payment happens outside the system;
/// Platform Admin records it.
/// </summary>
public partial class ServiceFee
{
    public Guid ServiceFeeId { get; set; }

    public Guid PlacementId { get; set; }

    public Guid CompanyId { get; set; }

    public decimal BaseSalary { get; set; }

    public decimal FeeMultiplier { get; set; }

    public decimal Amount { get; set; }

    public string CurrencyCode { get; set; } = null!;

    public DateOnly DueDate { get; set; }

    /// <summary>PENDING, PAID, OVERDUE or CANCELLED.</summary>
    public string Status { get; set; } = null!;

    public DateTime? PaidAt { get; set; }

    public string? PaymentReference { get; set; }

    public Guid? RecordedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Placement Placement { get; set; } = null!;

    public virtual Company Company { get; set; } = null!;
}
