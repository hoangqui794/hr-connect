using HRConnect.Application.Common.Models;

namespace HRConnect.Application.Common.Interfaces;

/// <summary>
/// Reusable HTTP client abstraction for communicating with HRConnect internal service endpoints.
/// Used by AI Service (MF-03) and downstream background services.
/// </summary>
public interface IHRConnectClient
{
    /// <summary>
    /// Calls HRConnect internal API (GET /api/internal/cvs/{cvId}/download-url) using service-to-service authentication
    /// to obtain a temporary presigned download URL and metadata for the Candidate CV.
    /// </summary>
    Task<CvDownloadUrlResult> GetCvDownloadUrlAsync(
        Guid cvId,
        int? expiryMinutes = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Obtains the presigned URL from HRConnect and downloads the candidate's PDF bytes immediately.
    /// Handles expired presigned URLs by refreshing and retrying.
    /// Sensitive tokens and presigned URLs are never logged or persisted.
    /// </summary>
    Task<byte[]> DownloadCvPdfAsync(
        Guid cvId,
        CancellationToken cancellationToken = default);
}
