using System.Net;
using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Internal.Queries.GetInternalCvDownloadUrl;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Integration;

/// <summary>
/// Implementation of IHRConnectClient for internal services (e.g. MF-03 AI Service).
/// Facilitates secure communication with HRConnect backend via internal APIs and service-to-service auth.
/// </summary>
public class HRConnectClient : IHRConnectClient
{
    private readonly HttpClient _httpClient;
    private readonly HRConnectClientOptions _options;
    private readonly ILogger<HRConnectClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public HRConnectClient(
        HttpClient httpClient,
        IOptions<HRConnectClientOptions> options,
        ILogger<HRConnectClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<CvDownloadUrlResult> GetCvDownloadUrlAsync(
        Guid cvId,
        int? expiryMinutes = null,
        CancellationToken cancellationToken = default)
    {
        var expiry = expiryMinutes ?? _options.DefaultExpiryMinutes;
        var relativeUrl = $"/api/v1/internal/cvs/{cvId}/download-url?expiryMinutes={expiry}";

        using var request = new HttpRequestMessage(HttpMethod.Get, relativeUrl);
        if (!string.IsNullOrWhiteSpace(_options.ServiceToken))
        {
            request.Headers.Add("X-Service-Token", _options.ServiceToken);
        }

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Lỗi kết nối khi gọi HRConnect internal API cho CvId {CvId}", cvId);
            throw new HttpRequestException($"Không thể kết nối đến HRConnect Backend: {ex.Message}", ex);
        }

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            _logger.LogWarning("AI Service chưa được xác thực với HRConnect (401 Unauthorized). Kiểm tra cấu hình HRCONNECT_SERVICE_TOKEN.");
            throw new UnauthorizedException("Dịch vụ chưa được xác thực với máy chủ HRConnect.");
        }

        if (response.StatusCode == HttpStatusCode.Forbidden)
        {
            _logger.LogWarning("AI Service bị từ chối quyền truy cập (403 Forbidden) cho CvId {CvId}.", cvId);
            throw new ForbiddenException("Dịch vụ không có quyền truy cập hồ sơ CV được yêu cầu.");
        }

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            _logger.LogWarning("Không tìm thấy CV với CvId {CvId} trên hệ thống HRConnect (404 NotFound).", cvId);
            throw new NotFoundException($"Không tìm thấy CV với mã {cvId}.");
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("HRConnect phản hồi lỗi {StatusCode} cho CvId {CvId}: {ErrorBody}", response.StatusCode, cvId, errorBody);
            throw new HttpRequestException($"HRConnect Backend trả về lỗi {(int)response.StatusCode}: {response.ReasonPhrase}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var apiResult = JsonSerializer.Deserialize<GetInternalCvDownloadUrlResponse>(json, JsonOptions);

        if (apiResult?.Success != true || apiResult.Data == null || string.IsNullOrWhiteSpace(apiResult.Data.DownloadUrl))
        {
            throw new InvalidOperationException($"Phản hồi từ HRConnect không hợp lệ khi lấy download URL cho CvId {cvId}.");
        }

        _logger.LogInformation("Lấy thành công presigned URL cho CvId {CvId}, hết hạn lúc {ExpiresAt}",
            cvId, apiResult.Data.ExpiresAt);

        return apiResult.Data;
    }

    public async Task<byte[]> DownloadCvPdfAsync(
        Guid cvId,
        CancellationToken cancellationToken = default)
    {
        var downloadInfo = await GetCvDownloadUrlAsync(cvId, cancellationToken: cancellationToken);

        // Kiểm tra nếu URL vừa nhận đã quá hạn (thời gian hệ thống lệch), yêu cầu cấp mới
        if (downloadInfo.ExpiresAt <= DateTime.UtcNow)
        {
            _logger.LogWarning("Presigned URL nhận được cho CvId {CvId} đã hết hạn. Đang làm mới...", cvId);
            downloadInfo = await GetCvDownloadUrlAsync(cvId, cancellationToken: cancellationToken);
        }

        byte[] pdfBytes;
        try
        {
            pdfBytes = await FetchPdfFromPresignedUrlAsync(downloadInfo.DownloadUrl, cancellationToken);
        }
        catch (PresignedUrlExpiredException)
        {
            _logger.LogWarning("Presigned URL cho CvId {CvId} bị hết hạn khi tải tệp. Đang yêu cầu URL mới và thử lại...", cvId);
            downloadInfo = await GetCvDownloadUrlAsync(cvId, cancellationToken: cancellationToken);
            pdfBytes = await FetchPdfFromPresignedUrlAsync(downloadInfo.DownloadUrl, cancellationToken);
        }

        // Kiểm tra tính toàn vẹn cơ bản của tệp PDF (magic bytes "%PDF")
        if (pdfBytes.Length < 4 ||
            pdfBytes[0] != 0x25 || pdfBytes[1] != 0x50 || pdfBytes[2] != 0x44 || pdfBytes[3] != 0x46)
        {
            _logger.LogError("Tệp tải về cho CvId {CvId} không phải định dạng PDF hợp lệ (độ dài: {Length} bytes).", cvId, pdfBytes.Length);
            throw new InvalidOperationException($"Tệp tải về cho CV {cvId} không phải định dạng PDF hợp lệ.");
        }

        _logger.LogInformation("Tải thành công tệp PDF cho CvId {CvId} (kích thước: {Length} bytes).", cvId, pdfBytes.Length);
        return pdfBytes;
    }

    private async Task<byte[]> FetchPdfFromPresignedUrlAsync(string presignedUrl, CancellationToken cancellationToken)
    {
        // Gửi GET trực tiếp đến Presigned URL của R2 (KHÔNG đính kèm header X-Service-Token để tránh lỗi chữ ký S3)
        using var pdfRequest = new HttpRequestMessage(HttpMethod.Get, presignedUrl);
        using var pdfResponse = await _httpClient.SendAsync(pdfRequest, HttpCompletionOption.ResponseContentRead, cancellationToken);

        if (pdfResponse.StatusCode == HttpStatusCode.Forbidden || pdfResponse.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new PresignedUrlExpiredException("Đường dẫn presigned URL đã hết hạn hoặc không còn hiệu lực.");
        }

        if (!pdfResponse.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Tải tệp PDF từ storage thất bại với mã lỗi HTTP {(int)pdfResponse.StatusCode}.");
        }

        var bytes = await pdfResponse.Content.ReadAsByteArrayAsync(cancellationToken);
        if (bytes.Length == 0)
        {
            throw new InvalidOperationException("Tệp PDF tải về rỗng (0 bytes).");
        }

        return bytes;
    }

    private sealed class PresignedUrlExpiredException : Exception
    {
        public PresignedUrlExpiredException(string message) : base(message) { }
    }
}
