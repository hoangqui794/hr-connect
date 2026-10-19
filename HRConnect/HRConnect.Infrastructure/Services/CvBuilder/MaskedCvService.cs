using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Recruitment.Queries.GetApplicationMaskedCv;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace HRConnect.Infrastructure.Services.CvBuilder;

/// <summary>N16: reads the stored CV through a short presigned link and renders the masked copy.</summary>
public sealed class MaskedCvService : IMaskedCvService
{
    public const string HttpClientName = "MaskedCvDownload";
    private const int MinCharsPerPage = 30;
    private const long MaxBytes = 15 * 1024 * 1024;

    private readonly ICvStorageService _storage;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly CvPdfRenderer _renderer;

    public MaskedCvService(ICvStorageService storage, IHttpClientFactory httpClientFactory, CvPdfRenderer renderer)
    {
        _storage = storage;
        _httpClientFactory = httpClientFactory;
        _renderer = renderer;
    }

    public async Task<IReadOnlyList<string>?> ReadPagesAsync(Guid cvId, CancellationToken cancellationToken = default)
    {
        var link = await _storage.GetCvDownloadUrlAsync(cvId, TimeSpan.FromMinutes(5), cancellationToken);
        using var response = await _httpClientFactory.CreateClient(HttpClientName)
            .GetAsync(link.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength > MaxBytes)
            throw new InvalidOperationException("CV vượt quá dung lượng cho phép.");
        var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        return ExtractPages(bytes);
    }

    public static IReadOnlyList<string>? ExtractPages(byte[] pdf)
    {
        using var document = PdfDocument.Open(pdf);
        var pages = document.GetPages().Select(page => ContentOrderTextExtractor.GetText(page)).ToList();
        return pages.Sum(p => p.Count(char.IsLetterOrDigit)) < MinCharsPerPage ? null : pages;
    }

    public byte[] Render(string title, string note, IReadOnlyList<string> paragraphs) =>
        _renderer.RenderPlain(title, note, paragraphs);
}
