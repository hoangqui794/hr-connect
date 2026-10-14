namespace HRConnect.Domain.Entities;

/// <summary>
/// MF-03 (CV_SOURCING): one qualified CV handed to the Client. The Client accepts or rejects it
/// within the review window; no answer by <see cref="ReviewDueAt"/> counts as accepted. Only
/// ACCEPTED and AUTO_ACCEPTED deliveries are billed (MF-05).
/// </summary>
public partial class SourcingDelivery
{
    public Guid DeliveryId { get; set; }

    public Guid JobId { get; set; }

    public Guid ApplicationId { get; set; }

    public string Status { get; set; } = null!;

    public DateTime DeliveredAt { get; set; }

    public Guid DeliveredBy { get; set; }

    public DateTime ReviewDueAt { get; set; }

    public DateTime? DecidedAt { get; set; }

    public Guid? DecidedBy { get; set; }

    public string? RejectReasonCode { get; set; }

    public string? RejectNote { get; set; }

    public Guid? ReplacedByDeliveryId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Job Job { get; set; } = null!;

    public virtual Application Application { get; set; } = null!;
}
