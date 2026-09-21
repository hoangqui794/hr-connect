using Amazon.S3;
using Amazon.S3.Model;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Storage;

public class CloudflareR2StorageService : IFileStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly R2Settings _settings;
    private readonly ILogger<CloudflareR2StorageService> _logger;

    public CloudflareR2StorageService(
        IAmazonS3 s3Client,
        IOptions<R2Settings> options,
        ILogger<CloudflareR2StorageService> logger)
    {
        _s3Client = s3Client;
        _settings = options.Value;
        _logger = logger;
    }

    public async Task<string> UploadAsync(
        Stream stream,
        string objectKey,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        ValidateConfiguration();

        if (stream == null || stream == Stream.Null)
        {
            throw new ArgumentException("Dữ liệu tải lên không được rỗng.", nameof(stream));
        }

        if (string.IsNullOrWhiteSpace(objectKey))
        {
            throw new ArgumentException("Mã khóa đối tượng (objectKey) không được để trống.", nameof(objectKey));
        }

        try
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = _settings.BucketName,
                Key = objectKey,
                InputStream = stream,
                ContentType = contentType,
                DisablePayloadSigning = true
            };

            _logger.LogInformation("Đang tải tệp lên Cloudflare R2: Bucket={Bucket}, Key={Key}, ContentType={ContentType}",
                _settings.BucketName, objectKey, contentType);

            var response = await _s3Client.PutObjectAsync(putRequest, cancellationToken);

            _logger.LogInformation("Tải tệp lên Cloudflare R2 thành công: Bucket={Bucket}, Key={Key}, StatusCode={StatusCode}",
                _settings.BucketName, objectKey, response.HttpStatusCode);

            return objectKey;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError("Lỗi AWS S3 khi tải tệp lên Cloudflare R2: Key={Key}, StatusCode={StatusCode}, ErrorCode={ErrorCode}, Message={Message}",
                objectKey, ex.StatusCode, ex.ErrorCode, ex.Message);
            throw new InvalidOperationException($"Lỗi lưu trữ khi tải tệp lên R2: {ex.Message}", ex);
        }
        catch (Exception ex) when (ex is not InvalidOperationException && ex is not ArgumentException)
        {
            _logger.LogError(ex, "Ngoại lệ không xác định khi tải tệp lên Cloudflare R2: Key={Key}", objectKey);
            throw new InvalidOperationException("Có lỗi xảy ra khi lưu trữ tệp lên đám mây.", ex);
        }
    }

    public async Task DeleteAsync(
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        ValidateConfiguration();

        if (string.IsNullOrWhiteSpace(objectKey))
        {
            return;
        }

        try
        {
            var deleteRequest = new DeleteObjectRequest
            {
                BucketName = _settings.BucketName,
                Key = objectKey
            };

            _logger.LogInformation("Đang xóa tệp khỏi Cloudflare R2: Bucket={Bucket}, Key={Key}",
                _settings.BucketName, objectKey);

            await _s3Client.DeleteObjectAsync(deleteRequest, cancellationToken);

            _logger.LogInformation("Xóa tệp khỏi Cloudflare R2 thành công: Bucket={Bucket}, Key={Key}",
                _settings.BucketName, objectKey);
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError("Lỗi AWS S3 khi xóa tệp khỏi Cloudflare R2: Key={Key}, StatusCode={StatusCode}, ErrorCode={ErrorCode}, Message={Message}",
                objectKey, ex.StatusCode, ex.ErrorCode, ex.Message);
            throw new InvalidOperationException($"Lỗi lưu trữ khi xóa tệp khỏi R2: {ex.Message}", ex);
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Ngoại lệ khi xóa tệp khỏi Cloudflare R2: Key={Key}", objectKey);
            throw new InvalidOperationException("Có lỗi xảy ra khi xóa tệp trên đám mây.", ex);
        }
    }

    public Task<string> GetPresignedDownloadUrlAsync(
        string objectKey,
        TimeSpan expiry,
        CancellationToken cancellationToken = default)
    {
        ValidateConfiguration();

        if (string.IsNullOrWhiteSpace(objectKey))
        {
            throw new ArgumentException("Mã khóa đối tượng (objectKey) không được để trống.", nameof(objectKey));
        }

        try
        {
            var preSignedRequest = new GetPreSignedUrlRequest
            {
                BucketName = _settings.BucketName,
                Key = objectKey,
                Expires = DateTime.UtcNow.Add(expiry),
                Verb = HttpVerb.GET
            };

            var url = _s3Client.GetPreSignedURL(preSignedRequest);

            _logger.LogInformation("Tạo URL tải xuống có chữ ký tạm thời cho R2: Key={Key}, Expiry={ExpiryTotalMinutes}m",
                objectKey, expiry.TotalMinutes);

            return Task.FromResult(url);
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError("Lỗi AWS S3 khi tạo presigned URL cho Cloudflare R2: Key={Key}, StatusCode={StatusCode}, ErrorCode={ErrorCode}",
                objectKey, ex.StatusCode, ex.ErrorCode);
            throw new InvalidOperationException($"Lỗi tạo đường dẫn tải xuống R2: {ex.Message}", ex);
        }
        catch (Exception ex) when (ex is not InvalidOperationException && ex is not ArgumentException)
        {
            _logger.LogError(ex, "Ngoại lệ khi tạo presigned URL cho Cloudflare R2: Key={Key}", objectKey);
            throw new InvalidOperationException("Có lỗi xảy ra khi tạo đường dẫn tải xuống.", ex);
        }
    }

    public async Task<bool> ExistsAsync(
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        ValidateConfiguration();

        if (string.IsNullOrWhiteSpace(objectKey))
        {
            return false;
        }

        try
        {
            var metadataRequest = new GetObjectMetadataRequest
            {
                BucketName = _settings.BucketName,
                Key = objectKey
            };

            await _s3Client.GetObjectMetadataAsync(metadataRequest, cancellationToken);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi kiểm tra sự tồn tại của tệp trên Cloudflare R2: Key={Key}", objectKey);
            return false;
        }
    }

    private void ValidateConfiguration()
    {
        if (string.IsNullOrWhiteSpace(_settings.BucketName))
        {
            throw new InvalidOperationException("Cấu hình R2_BUCKET_NAME chưa được thiết lập.");
        }
        if (string.IsNullOrWhiteSpace(_settings.Endpoint))
        {
            throw new InvalidOperationException("Cấu hình R2_ENDPOINT chưa được thiết lập.");
        }
    }
}
