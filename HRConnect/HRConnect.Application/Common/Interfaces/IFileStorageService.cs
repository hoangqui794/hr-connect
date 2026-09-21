namespace HRConnect.Application.Common.Interfaces;

/// <summary>
/// Reusable object storage interface for S3-compatible cloud storage (e.g. Cloudflare R2).
/// </summary>
public interface IFileStorageService
{
    /// <summary>
    /// Uploads a file stream to object storage under the specified object key.
    /// </summary>
    /// <returns>The stable object key stored.</returns>
    Task<string> UploadAsync(
        Stream stream,
        string objectKey,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes an object by its key.
    /// </summary>
    Task DeleteAsync(
        string objectKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a temporary, short-lived presigned download URL for private bucket objects.
    /// </summary>
    Task<string> GetPresignedDownloadUrlAsync(
        string objectKey,
        TimeSpan expiry,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks whether an object exists in storage.
    /// </summary>
    Task<bool> ExistsAsync(
        string objectKey,
        CancellationToken cancellationToken = default);
}
