namespace HRConnect.Domain.Entities;

/// <summary>
/// Operational verification of the start-work outcome reported by a Client for a
/// HEADHUNT_COD application. This record does not replace the Client's hiring
/// decision; it controls when placement finance may continue.
/// </summary>
public sealed class PlacementReconciliation
{
    public Guid ReconciliationId { get; set; }
    public Guid ApplicationId { get; set; }
    public Guid? PlacementId { get; set; }
    public string ClaimedOutcome { get; set; } = null!;
    public string Status { get; set; } = null!;
    public string? ContactChannel { get; set; }
    public string? Note { get; set; }
    public string? ResolutionNote { get; set; }
    public string? ResolutionAction { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Application Application { get; set; } = null!;
    public Placement? Placement { get; set; }
    public AppUser? ReviewedByNavigation { get; set; }
}
