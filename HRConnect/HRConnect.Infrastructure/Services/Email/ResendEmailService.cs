using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Email;

public class ResendEmailService : IEmailService
{
    private readonly HttpClient _httpClient;
    private readonly ResendSettings _settings;
    private readonly ILogger<ResendEmailService> _logger;
    private readonly string _apiKey;

    public ResendEmailService(
        HttpClient httpClient,
        IOptions<ResendSettings> options,
        IConfiguration configuration,
        ILogger<ResendEmailService> logger)
    {
        _httpClient = httpClient;
        _settings = options.Value;
        _logger = logger;

        _apiKey = !string.IsNullOrWhiteSpace(_settings.ApiKey)
            ? _settings.ApiKey
            : configuration["RESEND_API_KEY"] ?? string.Empty;

        if (_httpClient.BaseAddress == null)
        {
            _httpClient.BaseAddress = new Uri("https://api.resend.com/");
        }
    }

    public Task<EmailResult> SendEmailAsync(
        string to, 
        string subject, 
        string bodyHtml, 
        CancellationToken cancellationToken = default)
    {
        return SendEmailAsync(new[] { to }, subject, bodyHtml, cancellationToken);
    }

    public async Task<EmailResult> SendEmailAsync(
        IEnumerable<string> to, 
        string subject, 
        string bodyHtml, 
        CancellationToken cancellationToken = default)
    {
        var recipients = to.Where(e => !string.IsNullOrWhiteSpace(e)).Distinct().ToList();
        if (recipients.Count == 0)
        {
            _logger.LogWarning("Resend: Không có địa chỉ người nhận hợp lệ.");
            return EmailResult.Failure("Danh sách người nhận không hợp lệ hoặc rỗng.");
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogError("Resend: Chưa cấu hình Resend API Key trong file .env.");
            return EmailResult.Failure("Chưa cấu hình Resend API Key.");
        }

        try
        {
            var sender = !string.IsNullOrWhiteSpace(_settings.FromName)
                ? $"{_settings.FromName} <{_settings.FromEmail}>"
                : _settings.FromEmail;

            var payload = new ResendEmailRequest
            {
                From = sender,
                To = recipients,
                Subject = subject,
                Html = bodyHtml
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "emails")
            {
                Content = JsonContent.Create(payload)
            };

            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

            _logger.LogInformation("Đang gửi email qua Resend đến {Recipients}, Tiêu đề: {Subject}", 
                string.Join(", ", recipients), subject);

            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var successResult = JsonSerializer.Deserialize<ResendSuccessResponse>(responseContent);
                _logger.LogInformation("Gửi email thành công qua Resend! MessageId: {MessageId}", successResult?.Id);
                return EmailResult.Success(successResult?.Id ?? string.Empty);
            }
            else
            {
                var errorResult = JsonSerializer.Deserialize<ResendErrorResponse>(responseContent);
                var errorMessage = errorResult?.Message ?? responseContent;
                _logger.LogError("Lỗi khi gửi email qua Resend: Mã HTTP {StatusCode}, Chi tiết: {Error}", 
                    (int)response.StatusCode, errorMessage);

                return EmailResult.Failure($"Resend API Error ({(int)response.StatusCode}): {errorMessage}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ngoại lệ xảy ra khi gửi email qua Resend đến {Recipients}", string.Join(", ", recipients));
            return EmailResult.Failure($"Ngoại lệ khi gửi email: {ex.Message}");
        }
    }

    private sealed class ResendEmailRequest
    {
        [JsonPropertyName("from")]
        public string From { get; set; } = string.Empty;

        [JsonPropertyName("to")]
        public List<string> To { get; set; } = new();

        [JsonPropertyName("subject")]
        public string Subject { get; set; } = string.Empty;

        [JsonPropertyName("html")]
        public string Html { get; set; } = string.Empty;
    }

    private sealed class ResendSuccessResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;
    }

    private sealed class ResendErrorResponse
    {
        [JsonPropertyName("statusCode")]
        public int? StatusCode { get; set; }

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
