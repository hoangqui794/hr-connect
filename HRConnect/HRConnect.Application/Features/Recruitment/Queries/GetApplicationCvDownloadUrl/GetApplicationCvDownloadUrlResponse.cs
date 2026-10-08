namespace HRConnect.Application.Features.Recruitment.Queries.GetApplicationCvDownloadUrl;

public class GetApplicationCvDownloadUrlResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy đường dẫn xem CV thành công.";

    public ApplicationCvDownloadUrlData Data { get; set; } = new();
}

public class ApplicationCvDownloadUrlData
{
    public Guid ApplicationId { get; set; }

    public Guid CvId { get; set; }

    public string FileName { get; set; } = string.Empty;

    public string MimeType { get; set; } = "application/pdf";

    public string DownloadUrl { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
}
