namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateCvDownloadUrl;

public sealed record GetAffiliateCandidateCvDownloadUrlResponse
{
    public bool Success { get; init; } = true;
    public required AffiliateCandidateCvDownloadUrlDto Data { get; init; }
}

public sealed record AffiliateCandidateCvDownloadUrlDto(
    Guid CvId,
    string FileName,
    string MimeType,
    string DownloadUrl,
    DateTime ExpiresAt);
