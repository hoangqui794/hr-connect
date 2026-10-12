using System;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Khoản phí đăng tin dịch vụ CV_APPLICATION theo từng Job và Gói đăng tin đã chọn.
/// </summary>
public partial class JobPostingFee
{
    public Guid PostingFeeId { get; set; }

    public Guid JobId { get; set; }

    public Guid PackageId { get; set; }

    public Guid CompanyId { get; set; }

    public decimal Amount { get; set; }

    public string CurrencyCode { get; set; } = "VND";

    /// <summary>PENDING, PAID, CANCELLED.</summary>
    public string Status { get; set; } = null!;

    public DateTime? PaidAt { get; set; }

    public string? PaymentReference { get; set; }

    public Guid? RecordedBy { get; set; }

    public DateTime? ActivatedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Job Job { get; set; } = null!;

    public virtual JobPostingPackage Package { get; set; } = null!;

    public virtual Company Company { get; set; } = null!;

    public virtual AppUser? RecordedByNavigation { get; set; }
}
