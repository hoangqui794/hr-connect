namespace HRConnect.Domain.Entities;

/// <summary>Durable queue for deleting obsolete owned image objects after the database pointer is committed.</summary>
public sealed class StorageCleanupJob
{
    public Guid StorageCleanupJobId { get; set; }
    public Guid? UserId { get; set; }
    public string ObjectKey { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string Status { get; set; } = "PENDING";
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public DateTime? ProcessingStartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public AppUser? User { get; set; }
}
