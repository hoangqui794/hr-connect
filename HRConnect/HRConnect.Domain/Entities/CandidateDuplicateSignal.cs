namespace HRConnect.Domain.Entities;

/// <summary>Minimized, versioned evidence supporting a duplicate case. Raw PII and CV text are forbidden.</summary>
public sealed class CandidateDuplicateSignal
{
    public Guid DuplicateSignalId { get; set; }
    public Guid DuplicateCaseId { get; set; }
    public string ReasonCode { get; set; } = null!;
    public string DetectorVersion { get; set; } = null!;
    public decimal Score { get; set; }
    public string? KeyVersion { get; set; }
    public string Evidence { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }

    public CandidateDuplicateCase DuplicateCase { get; set; } = null!;
}
