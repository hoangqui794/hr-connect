using HRConnect.Application.Common.Models;

namespace HRConnect.Application.Common.Interfaces;

public interface ICvStorageService
{
    /// <summary>
    /// Validates, uploads a PDF CV to Cloudflare R2, saves the CandidateCv entity with stable object key,
    /// and performs compensation deletion on R2 if the database transaction fails.
    /// </summary>
    Task<UploadCvResult> UploadCvPdfAsync(
        Guid candidateId,
        Stream fileStream,
        string fileName,
        long fileSizeBytes,
        string? title = null,
        bool isPrimary = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Uploads a CV supplied by an affiliate and records its provenance. Affiliate
    /// uploads are submission documents and are not part of the candidate's personal CV library.
    /// </summary>
    Task<UploadCvResult> UploadAffiliateCvPdfAsync(
        Guid candidateId,
        Guid affiliateUserId,
        Stream fileStream,
        string fileName,
        long fileSizeBytes,
        string? title = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a temporary presigned GET URL for downloading the private CV PDF.
    /// </summary>
    Task<CvDownloadUrlResult> GetCvDownloadUrlAsync(
        Guid cvId,
        TimeSpan? expiry = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes the database record first, then performs best-effort Cloudflare R2 cleanup.
    /// The storage object is never removed when the database delete fails.
    /// </summary>
    Task DeleteCvAsync(
        Guid cvId,
        CancellationToken cancellationToken = default);
}
