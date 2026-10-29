namespace HRConnect.Application.Common.Models;

public class R2Settings
{
    public const string SectionName = "R2";

    public string AccountId { get; set; } = string.Empty;

    public string AccessKeyId { get; set; } = string.Empty;

    public string SecretAccessKey { get; set; } = string.Empty;

    public string BucketName { get; set; } = string.Empty;

    public string Endpoint { get; set; } = string.Empty;

    public int MaxCvFileSizeMb { get; set; } = 10;

    public long MaxCvFileSizeBytes => (long)MaxCvFileSizeMb * 1024 * 1024;

    public int MaxCvPdfPages { get; set; } = 30;

    public int PresignedUrlExpiryMinutes { get; set; } = 15;

    public int MaxPresignedUrlExpiryMinutes { get; set; } = 60;

    public int MaxAvatarFileSizeMb { get; set; } = 5;

    public long MaxAvatarFileSizeBytes => (long)MaxAvatarFileSizeMb * 1024 * 1024;

    /// <summary>Company logos may be straight from a camera or design tool, so they get a larger limit than avatars.</summary>
    public int MaxCompanyLogoFileSizeMb { get; set; } = 10;

    public long MaxCompanyLogoFileSizeBytes => (long)MaxCompanyLogoFileSizeMb * 1024 * 1024;

    // Large enough for a 24 MP phone photo (6000 x 4000); the output is resized to AvatarOutputSize.
    public int MaxAvatarWidth { get; set; } = 8192;

    public int MaxAvatarHeight { get; set; } = 8192;

    public long MaxAvatarPixels { get; set; } = 25_000_000;

    public int AvatarOutputSize { get; set; } = 1024;

    public int AvatarWebpQuality { get; set; } = 85;

    public int AvatarPresignedUrlExpiryMinutes { get; set; } = 10;

    public string? PublicApiBaseUrl { get; set; }

    public string? PublicBaseUrl { get; set; }
}
