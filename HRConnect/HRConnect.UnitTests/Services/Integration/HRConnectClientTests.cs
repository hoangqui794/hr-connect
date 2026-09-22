using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Internal.Queries.GetInternalCvDownloadUrl;
using HRConnect.Infrastructure.Services.Integration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Xunit;

namespace HRConnect.UnitTests.Services.Integration;

public class HRConnectClientTests
{
    private const string ServiceToken = "test_internal_token_secret";
    private readonly Mock<ILogger<HRConnectClient>> _loggerMock = new();
    private readonly IOptions<HRConnectClientOptions> _options = Options.Create(new HRConnectClientOptions
    {
        BaseUrl = "http://localhost:5041",
        ServiceToken = ServiceToken,
        DefaultExpiryMinutes = 15,
        MaxRetries = 2
    });

    private static readonly byte[] ValidPdfBytes = Encoding.UTF8.GetBytes("%PDF-1.7 Test PDF Content for HRConnect Unit Test");

    private HRConnectClient CreateClient(Mock<HttpMessageHandler> handlerMock)
    {
        var httpClient = new HttpClient(handlerMock.Object)
        {
            BaseAddress = new Uri("http://localhost:5041/")
        };
        return new HRConnectClient(httpClient, _options, _loggerMock.Object);
    }

    [Fact]
    public async Task GetCvDownloadUrlAsync_WhenValidCvId_ReturnsDownloadInfo()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var downloadUrl = "https://r2.example.com/test.pdf?sig=test_signature";
        var expiresAt = DateTime.UtcNow.AddMinutes(15);

        var apiResponse = new GetInternalCvDownloadUrlResponse
        {
            Success = true,
            Message = "Lấy đường dẫn tải xuống CV thành công.",
            Data = new CvDownloadUrlResult
            {
                CvId = cvId,
                FileName = "candidate_resume.pdf",
                MimeType = "application/pdf",
                DownloadUrl = downloadUrl,
                ExpiresAt = expiresAt
            }
        };

        var handlerMock = new Mock<HttpMessageHandler>();
        HttpRequestMessage? capturedRequest = null;

        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => capturedRequest = req)
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            });

        var client = CreateClient(handlerMock);

        // Act
        var result = await client.GetCvDownloadUrlAsync(cvId);

        // Assert
        result.Should().NotBeNull();
        result.CvId.Should().Be(cvId);
        result.FileName.Should().Be("candidate_resume.pdf");
        result.DownloadUrl.Should().Be(downloadUrl);
        result.ExpiresAt.Should().BeCloseTo(expiresAt, TimeSpan.FromSeconds(1));

        capturedRequest.Should().NotBeNull();
        capturedRequest!.Headers.Contains("X-Service-Token").Should().BeTrue();
        capturedRequest.Headers.GetValues("X-Service-Token").Should().Contain(ServiceToken);
    }

    [Fact]
    public async Task GetCvDownloadUrlAsync_WhenHRConnectReturns404_ThrowsNotFoundException()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var handlerMock = new Mock<HttpMessageHandler>();

        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.NotFound,
                Content = new StringContent("{\"success\":false,\"message\":\"Không tìm thấy CV\"}")
            });

        var client = CreateClient(handlerMock);

        // Act
        Func<Task> act = async () => await client.GetCvDownloadUrlAsync(cvId);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{cvId}*");
    }

    [Fact]
    public async Task GetCvDownloadUrlAsync_WhenHRConnectReturns401_ThrowsUnauthorizedException()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var handlerMock = new Mock<HttpMessageHandler>();

        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.Unauthorized,
                Content = new StringContent("{\"success\":false,\"message\":\"Thiếu token\"}")
            });

        var client = CreateClient(handlerMock);

        // Act
        Func<Task> act = async () => await client.GetCvDownloadUrlAsync(cvId);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task GetCvDownloadUrlAsync_WhenHRConnectReturns403_ThrowsForbiddenException()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var handlerMock = new Mock<HttpMessageHandler>();

        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.Forbidden,
                Content = new StringContent("{\"success\":false,\"message\":\"Token không hợp lệ\"}")
            });

        var client = CreateClient(handlerMock);

        // Act
        Func<Task> act = async () => await client.GetCvDownloadUrlAsync(cvId);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task DownloadCvPdfAsync_WhenValidPdf_DownloadsBytesSuccessfully()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var presignedUrl = "https://r2.example.com/presigned-cv.pdf?auth=token";

        var apiResponse = new GetInternalCvDownloadUrlResponse
        {
            Success = true,
            Data = new CvDownloadUrlResult
            {
                CvId = cvId,
                FileName = "cv.pdf",
                MimeType = "application/pdf",
                DownloadUrl = presignedUrl,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15)
            }
        };

        var handlerMock = new Mock<HttpMessageHandler>();

        // 1. Phản hồi cho API lấy URL nội bộ
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(r => r.RequestUri!.ToString().Contains("/api/internal/cvs")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            });

        // 2. Phản hồi cho GET tải file PDF từ presigned URL
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(r => r.RequestUri!.ToString().Contains("r2.example.com")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new ByteArrayContent(ValidPdfBytes)
            });

        var client = CreateClient(handlerMock);

        // Act
        var result = await client.DownloadCvPdfAsync(cvId);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeEquivalentTo(ValidPdfBytes);
    }

    [Fact]
    public async Task DownloadCvPdfAsync_WhenPresignedUrlExpired_RefreshesUrlAndRetries()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var expiredPresignedUrl = "https://r2.example.com/expired.pdf";
        var freshPresignedUrl = "https://r2.example.com/fresh.pdf";

        var firstResponse = new GetInternalCvDownloadUrlResponse
        {
            Success = true,
            Data = new CvDownloadUrlResult
            {
                CvId = cvId,
                DownloadUrl = expiredPresignedUrl,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15)
            }
        };

        var secondResponse = new GetInternalCvDownloadUrlResponse
        {
            Success = true,
            Data = new CvDownloadUrlResult
            {
                CvId = cvId,
                DownloadUrl = freshPresignedUrl,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15)
            }
        };

        var handlerMock = new Mock<HttpMessageHandler>();
        var internalApiCallCount = 0;

        // Mock Internal API (trả về URL cũ lần 1, URL mới lần 2)
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(r => r.RequestUri!.ToString().Contains("/api/internal/cvs")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() =>
            {
                internalApiCallCount++;
                var resp = internalApiCallCount == 1 ? firstResponse : secondResponse;
                return new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent(JsonSerializer.Serialize(resp), Encoding.UTF8, "application/json")
                };
            });

        // Mock Presigned URL download: expiredUrl trả về 403 Forbidden, freshUrl trả về 200 OK
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(r => r.RequestUri!.ToString().Contains("expired.pdf")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.Forbidden
            });

        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(r => r.RequestUri!.ToString().Contains("fresh.pdf")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new ByteArrayContent(ValidPdfBytes)
            });

        var client = CreateClient(handlerMock);

        // Act
        var result = await client.DownloadCvPdfAsync(cvId);

        // Assert
        result.Should().BeEquivalentTo(ValidPdfBytes);
        internalApiCallCount.Should().Be(2); // Xác minh đã tự động refresh URL
    }

    [Fact]
    public async Task DownloadCvPdfAsync_WhenInvalidMagicBytes_ThrowsInvalidOperationException()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var presignedUrl = "https://r2.example.com/not_a_pdf.pdf";

        var apiResponse = new GetInternalCvDownloadUrlResponse
        {
            Success = true,
            Data = new CvDownloadUrlResult
            {
                CvId = cvId,
                DownloadUrl = presignedUrl,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15)
            }
        };

        var handlerMock = new Mock<HttpMessageHandler>();

        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(r => r.RequestUri!.ToString().Contains("/api/internal/cvs")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            });

        // Trả về HTML thay vì PDF
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(r => r.RequestUri!.ToString().Contains("not_a_pdf.pdf")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent("<html><body>Error Page</body></html>")
            });

        var client = CreateClient(handlerMock);

        // Act
        Func<Task> act = async () => await client.DownloadCvPdfAsync(cvId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*định dạng PDF hợp lệ*");
    }
}
