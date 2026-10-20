namespace HRConnect.Application.Common.Settings;

public sealed class CandidateIdentityEvidenceSettings
{
    public const string SectionName = "CandidateIdentityEvidence";

    /// <summary>
    /// Enables privacy-preserving identity evidence and duplicate detection.
    /// Roll out with ShadowMode=true before identity-review holds are enabled.
    /// </summary>
    public bool Enabled { get; set; }

    public bool ShadowMode { get; set; } = true;

    public string ActiveKeyVersion { get; set; } = "v1";

    /// <summary>Base64-encoded HMAC keys indexed by version. Secrets must come from environment/secret storage.</summary>
    public Dictionary<string, string> Keys { get; set; } = new(StringComparer.Ordinal);
}
