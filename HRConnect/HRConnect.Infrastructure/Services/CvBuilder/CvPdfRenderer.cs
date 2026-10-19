using System.Reflection;
using System.Text.Json;
using HRConnect.Application.Features.Candidates.CvBuilder;
using SkiaSharp;

namespace HRConnect.Infrastructure.Services.CvBuilder;

/// <summary>
/// BE-04 B: draws a structured CV as a text PDF (A4) with SkiaSharp, so the CV PDF checks, recruiters and the
/// AI read it like an uploaded CV. Uses the bundled Roboto font (Apache 2.0) for Vietnamese.
/// The template's TemplateConfig may set "accentColor" (#RRGGBB) and "density" ("normal" | "compact").
/// </summary>
public sealed class CvPdfRenderer
{
    private const float PageWidth = 595f;   // A4 in points
    private const float PageHeight = 842f;
    private const float Margin = 48f;
    private const string DefaultAccent = "#0F766E";

    private static readonly Lazy<SKTypeface> Roboto = new(() =>
    {
        using var stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("HRConnect.Infrastructure.Assets.Fonts.Roboto-Regular.ttf")
            ?? throw new InvalidOperationException("Thiếu font Roboto nhúng trong Infrastructure.");
        return SKTypeface.FromStream(stream);
    });

    /// <summary>N16: a plain text document (title, muted note, one paragraph per line) in the same style.</summary>
    public byte[] RenderPlain(string title, string note, IReadOnlyList<string> paragraphs)
    {
        using var output = new MemoryStream();
        using (var document = SKDocument.CreatePdf(output, new SKDocumentPdfMetadata
               {
                   Title = title,
                   Creator = "HR Connect",
                   Producer = "HR Connect",
               }))
        {
            var writer = new PageWriter(document, SKColor.Parse(DefaultAccent), 1f);
            writer.Title(title);
            writer.Body(note, muted: true);
            writer.Rule();
            foreach (var paragraph in paragraphs)
            {
                writer.Body(paragraph);
            }
            writer.Finish();
        }

        return output.ToArray();
    }

    public byte[] Render(StructuredCvContent cv, string? templateConfig)
    {
        var (accent, scale) = ReadConfig(templateConfig);
        using var output = new MemoryStream();
        using (var document = SKDocument.CreatePdf(output, new SKDocumentPdfMetadata
               {
                   Title = $"CV - {cv.FullName}",
                   Author = cv.FullName,
                   Creator = "HR Connect",
                   Producer = "HR Connect CV Builder",
               }))
        {
            var writer = new PageWriter(document, accent, scale);
            writer.Title(cv.FullName);
            if (cv.Headline != null) writer.Subtitle(cv.Headline);
            var contact = string.Join("  |  ", new[] { cv.Email, cv.Phone, cv.Address }.Where(v => !string.IsNullOrWhiteSpace(v)));
            if (contact.Length > 0) writer.Body(contact, muted: true);
            writer.Rule();

            if (cv.Summary != null)
            {
                writer.Section("Mục tiêu nghề nghiệp");
                writer.Body(cv.Summary);
            }

            if (cv.Experiences is { Count: > 0 })
            {
                writer.Section("Kinh nghiệm làm việc");
                foreach (var e in cv.Experiences)
                {
                    writer.ItemTitle(string.Join(" - ", new[] { e.Title, e.Company }.Where(v => v != null)));
                    var period = Period(e.StartDate, e.EndDate);
                    if (period != null) writer.Body(period, muted: true);
                    if (e.Description != null) writer.Body(e.Description);
                    writer.Gap();
                }
            }

            if (cv.Educations is { Count: > 0 })
            {
                writer.Section("Học vấn");
                foreach (var e in cv.Educations)
                {
                    writer.ItemTitle(string.Join(" - ", new[] { e.School, e.Degree }.Where(v => v != null)));
                    var period = Period(e.StartDate, e.EndDate);
                    if (period != null) writer.Body(period, muted: true);
                    if (e.Description != null) writer.Body(e.Description);
                    writer.Gap();
                }
            }

            WriteList(writer, "Kỹ năng", cv.Skills);
            WriteList(writer, "Ngoại ngữ", cv.Languages);
            WriteList(writer, "Chứng chỉ", cv.Certificates);
            writer.Finish();
            document.Close();
        }

        return output.ToArray();
    }

    private static void WriteList(PageWriter writer, string title, IReadOnlyList<string>? items)
    {
        if (items is not { Count: > 0 }) return;
        writer.Section(title);
        foreach (var item in items) writer.Body($"• {item}");
    }

    private static string? Period(string? start, string? end) =>
        start == null && end == null ? null : $"{start ?? "?"} - {end ?? "nay"}";

    private static (SKColor Accent, float Scale) ReadConfig(string? templateConfig)
    {
        var accent = SKColor.Parse(DefaultAccent);
        var scale = 1f;
        if (string.IsNullOrWhiteSpace(templateConfig)) return (accent, scale);
        try
        {
            using var json = JsonDocument.Parse(templateConfig);
            if (json.RootElement.TryGetProperty("accentColor", out var color) && SKColor.TryParse(color.GetString(), out var parsed))
                accent = parsed;
            if (json.RootElement.TryGetProperty("density", out var density) && density.GetString() == "compact")
                scale = 0.9f;
        }
        catch (JsonException)
        {
            // A broken template config falls back to the default look instead of failing the CV.
        }

        return (accent, scale);
    }

    /// <summary>Flows text top to bottom, wrapping words and starting new pages as needed.</summary>
    private sealed class PageWriter
    {
        private readonly SKDocument _document;
        private readonly SKColor _accent;
        private readonly float _scale;
        private SKCanvas? _canvas;
        private float _y;

        public PageWriter(SKDocument document, SKColor accent, float scale)
        {
            _document = document;
            _accent = accent;
            _scale = scale;
            NewPage();
        }

        public void Title(string text) => Write(text, 22, _accent, bold: true, spacingAfter: 4);

        public void Subtitle(string text) => Write(text, 13, SKColors.DimGray, bold: false, spacingAfter: 4);

        public void Section(string text)
        {
            Space(10);
            Write(text.ToUpperInvariant(), 11.5f, _accent, bold: true, spacingAfter: 2);
            Line(_accent, 0.8f);
            Space(4);
        }

        public void ItemTitle(string text) => Write(text, 11, SKColors.Black, bold: true, spacingAfter: 1);

        public void Body(string text, bool muted = false) =>
            Write(text, 10, muted ? SKColors.Gray : new SKColor(0x22, 0x22, 0x22), bold: false, spacingAfter: 2);

        public void Gap() => Space(4);

        public void Rule()
        {
            Space(4);
            Line(SKColors.LightGray, 0.6f);
            Space(6);
        }

        public void Finish() => _document.EndPage();

        private void NewPage()
        {
            if (_canvas != null) _document.EndPage();
            _canvas = _document.BeginPage(PageWidth, PageHeight);
            _y = Margin;
        }

        private void Space(float points) => _y += points * _scale;

        private void Line(SKColor color, float width)
        {
            EnsureRoom(4);
            using var paint = new SKPaint { Color = color, StrokeWidth = width, IsAntialias = true };
            _canvas!.DrawLine(Margin, _y, PageWidth - Margin, _y, paint);
            _y += 2;
        }

        private void EnsureRoom(float height)
        {
            if (_y + height > PageHeight - Margin) NewPage();
        }

        private void Write(string text, float size, SKColor color, bool bold, float spacingAfter)
        {
            using var font = new SKFont(Roboto.Value, size * _scale) { Embolden = bold, Subpixel = true };
            using var paint = new SKPaint { Color = color, IsAntialias = true };
            var lineHeight = font.Spacing * 1.15f;
            var maxWidth = PageWidth - 2 * Margin;
            foreach (var paragraph in text.Replace("\r\n", "\n").Split('\n'))
            {
                foreach (var line in Wrap(paragraph, font, maxWidth))
                {
                    EnsureRoom(lineHeight);
                    _y += lineHeight;
                    _canvas!.DrawText(line, Margin, _y - font.Metrics.Descent, SKTextAlign.Left, font, paint);
                }
            }

            _y += spacingAfter * _scale;
        }

        private static IEnumerable<string> Wrap(string paragraph, SKFont font, float maxWidth)
        {
            if (paragraph.Length == 0)
            {
                yield return string.Empty;
                yield break;
            }

            var line = string.Empty;
            foreach (var word in paragraph.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var candidate = line.Length == 0 ? word : $"{line} {word}";
                if (font.MeasureText(candidate) <= maxWidth)
                {
                    line = candidate;
                    continue;
                }

                if (line.Length > 0) yield return line;
                line = word;
                // A single word longer than the line is cut so it never runs off the page.
                while (font.MeasureText(line) > maxWidth && line.Length > 1)
                {
                    var cut = line.Length - 1;
                    while (cut > 1 && font.MeasureText(line[..cut]) > maxWidth) cut--;
                    yield return line[..cut];
                    line = line[cut..];
                }
            }

            if (line.Length > 0) yield return line;
        }
    }
}
