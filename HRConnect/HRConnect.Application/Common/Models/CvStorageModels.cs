namespace HRConnect.Application.Common.Models;

public class UploadCvResult
{
    public Guid CvId { get; set; }
    public Guid CandidateId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/pdf";
    public long FileSizeBytes { get; set; }
    public bool IsPrimary { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime CreatedAt { get; set; }
}

public class CvDownloadUrlResult
{
    public Guid CvId { get; set; }
    public string DownloadUrl { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
