namespace HRConnect.Application.Common.Models;

public class R2Settings
{
    public const string SectionName = "R2";

    public string AccountId { get; set; } = "ea997660e8c1f6c92b939eb22891843c";

    public string AccessKeyId { get; set; } = string.Empty;

    public string SecretAccessKey { get; set; } = string.Empty;

    public string BucketName { get; set; } = "hrconnect-candidate-cvs";

    public string Endpoint { get; set; } = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com";

    public int MaxCvFileSizeMb { get; set; } = 10;

    public long MaxCvFileSizeBytes => (long)MaxCvFileSizeMb * 1024 * 1024;

    public int PresignedUrlExpiryMinutes { get; set; } = 15;

    public int MaxPresignedUrlExpiryMinutes { get; set; } = 60;

    public int MaxAvatarFileSizeMb { get; set; } = 5;

    public long MaxAvatarFileSizeBytes => (long)MaxAvatarFileSizeMb * 1024 * 1024;

    public string? PublicBaseUrl { get; set; }
}
