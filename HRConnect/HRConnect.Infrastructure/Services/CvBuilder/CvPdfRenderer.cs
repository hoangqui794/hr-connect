using System.Reflection;
using System.Text.Json;
using HRConnect.Application.Features.Candidates.CvBuilder;
using SkiaSharp;

namespace HRConnect.Infrastructure.Services.CvBuilder;

/// <summary>
/// BE-04 B: draws a structured CV as a text PDF (A4) with SkiaSharp, so the CV PDF checks, recruiters and the
/// AI read it like an uploaded CV. Uses the bundled Roboto font (Apache 2.0) for Vietnamese.
/// TemplateConfig and the CV's saved presentation may set accent, density, layout and embedded font.
/// </summary>
public sealed class CvPdfRenderer
{
    private const float PageWidth = 595f;   // A4 in points
    private const float PageHeight = 842f;
    private const float Margin = 48f;
    private const string DefaultAccent = "#0F766E";

    private static readonly Lazy<SKTypeface> Roboto = new(() => LoadTypeface("Roboto-Regular.ttf"));
    private static readonly Lazy<SKTypeface> BeVietnamPro = new(() => LoadTypeface("BeVietnamPro-Regular.ttf"));
    private static readonly Lazy<SKTypeface> Inter = new(() => LoadTypeface("Inter-Variable.ttf"));

    private sealed record CvTheme(
        SKColor Accent,
        float Scale,
        string Layout,
        SKTypeface Typeface,
        IReadOnlySet<string> VisibleSections,
        bool ShowAvatar);

    private static readonly string[] AllSections =
        ["summary", "experiences", "projects", "educations", "activities", "skills", "languages", "certificates"];

    private static SKTypeface LoadTypeface(string fileName)
    {
        using var stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream($"HRConnect.Infrastructure.Assets.Fonts.{fileName}")
            ?? throw new InvalidOperationException($"Thiếu font {fileName} nhúng trong Infrastructure.");
        return SKTypeface.FromStream(stream);
    }

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
            var writer = new PageWriter(document, new CvTheme(
                SKColor.Parse(DefaultAccent), 1f, "ats", Roboto.Value,
                new HashSet<string>(AllSections, StringComparer.OrdinalIgnoreCase), false));
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

    public byte[] Render(StructuredCvContent cv, string? templateConfig, byte[]? avatarBytes = null)
    {
        var theme = ReadConfig(templateConfig, cv.Presentation);
        using var output = new MemoryStream();
        using (var document = SKDocument.CreatePdf(output, new SKDocumentPdfMetadata
               {
                   Title = $"CV - {cv.FullName}",
                   Author = cv.FullName,
                   Creator = "HR Connect",
                   Producer = "HR Connect CV Builder",
               }))
        {
            var writer = new PageWriter(document, theme);
            writer.HeaderRule();
            if (theme.ShowAvatar && avatarBytes is { Length: > 0 }) writer.Avatar(avatarBytes);
            writer.Title(cv.FullName);
            if (cv.Headline != null) writer.Subtitle(cv.Headline);
            var contact = string.Join("  |  ", new[] { cv.Email, cv.Phone, cv.Address }.Where(v => !string.IsNullOrWhiteSpace(v)));
            if (contact.Length > 0) writer.Contact(contact);
            writer.Rule();

            if (theme.VisibleSections.Contains("summary") && cv.Summary != null)
            {
                writer.Section("Mục tiêu nghề nghiệp");
                writer.Body(cv.Summary);
            }

            if (theme.VisibleSections.Contains("experiences") && cv.Experiences is { Count: > 0 })
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

            if (theme.VisibleSections.Contains("projects") && cv.Projects is { Count: > 0 })
            {
                writer.Section("Dự án nổi bật");
                foreach (var project in cv.Projects)
                {
                    writer.ItemTitle(string.Join(" - ", new[] { project.Name, project.Role }.Where(v => v != null)));
                    var period = Period(project.StartDate, project.EndDate);
                    if (period != null) writer.Body(period, muted: true);
                    if (project.Technologies != null) writer.Body($"Công nghệ: {project.Technologies}", muted: true);
                    if (project.Description != null) writer.Body(project.Description);
                    if (project.Url != null) writer.Body(project.Url, muted: true);
                    writer.Gap();
                }
            }

            if (theme.VisibleSections.Contains("educations") && cv.Educations is { Count: > 0 })
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

            if (theme.VisibleSections.Contains("activities") && cv.Activities is { Count: > 0 })
            {
                writer.Section("Hoạt động");
                foreach (var activity in cv.Activities)
                {
                    writer.ItemTitle(string.Join(" - ", new[] { activity.Name, activity.Role }.Where(v => v != null)));
                    var period = Period(activity.StartDate, activity.EndDate);
                    if (period != null) writer.Body(period, muted: true);
                    if (activity.Description != null) writer.Body(activity.Description);
                    writer.Gap();
                }
            }

            if (theme.VisibleSections.Contains("skills")) WriteList(writer, "Kỹ năng", cv.Skills);
            if (theme.VisibleSections.Contains("languages")) WriteList(writer, "Ngoại ngữ", cv.Languages);
            if (theme.VisibleSections.Contains("certificates")) WriteList(writer, "Chứng chỉ", cv.Certificates);
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

    private static CvTheme ReadConfig(string? templateConfig, CvPresentation? presentation)
    {
        var accent = SKColor.Parse(DefaultAccent);
        var scale = 1f;
        var layout = "ats";
        var font = "BE_VIETNAM_PRO";
        var visibleSections = new HashSet<string>(AllSections, StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(templateConfig))
        {
            try
            {
                using var json = JsonDocument.Parse(templateConfig);
                if (json.RootElement.TryGetProperty("accentColor", out var color) && SKColor.TryParse(color.GetString(), out var parsed))
                    accent = parsed;
                if (json.RootElement.TryGetProperty("density", out var density))
                    scale = DensityScale(density.GetString());
                if (json.RootElement.TryGetProperty("layout", out var templateLayout) && !string.IsNullOrWhiteSpace(templateLayout.GetString()))
                    layout = templateLayout.GetString()!.ToLowerInvariant();
                if (json.RootElement.TryGetProperty("fontFamily", out var templateFont) && !string.IsNullOrWhiteSpace(templateFont.GetString()))
                    font = templateFont.GetString()!.ToUpperInvariant();
                if (json.RootElement.TryGetProperty("sections", out var sections) && sections.ValueKind == JsonValueKind.Array)
                {
                    visibleSections = NormalizeSections(sections.EnumerateArray().Select(item => item.GetString()));
                }
            }
            catch (JsonException)
            {
                // A broken template config falls back to the safe ATS presentation.
            }
        }

        if (presentation != null)
        {
            if (SKColor.TryParse(presentation.AccentColor, out var chosenAccent)) accent = chosenAccent;
            scale = DensityScale(presentation.Density);
            layout = presentation.Layout?.ToLowerInvariant() ?? layout;
            font = presentation.FontFamily?.ToUpperInvariant() ?? font;
            if (presentation.VisibleSections is { Count: > 0 })
                visibleSections = NormalizeSections(presentation.VisibleSections);
        }

        var typeface = font switch
        {
            "INTER" => Inter.Value,
            "ROBOTO" => Roboto.Value,
            _ => BeVietnamPro.Value,
        };
        return new CvTheme(accent, scale, layout, typeface, visibleSections, presentation?.ShowAvatar == true);
    }

    private static HashSet<string> NormalizeSections(IEnumerable<string?> sections)
    {
        var normalized = sections
            .Where(section => !string.IsNullOrWhiteSpace(section))
            .Select(section => section!.Trim().ToLowerInvariant() switch
            {
                "experience" => "experiences",
                "education" => "educations",
                var normalizedSection => normalizedSection,
            })
            .Where(section => AllSections.Contains(section, StringComparer.OrdinalIgnoreCase));
        var result = new HashSet<string>(normalized, StringComparer.OrdinalIgnoreCase);
        return result.Count > 0
            ? result
            : new HashSet<string>(AllSections, StringComparer.OrdinalIgnoreCase);
    }

    private static float DensityScale(string? density) => density?.ToLowerInvariant() switch
    {
        "compact" => 0.9f,
        "spacious" => 1.08f,
        _ => 1f,
    };

    /// <summary>Flows text top to bottom, wrapping words and starting new pages as needed.</summary>
    private sealed class PageWriter
    {
        private readonly SKDocument _document;
        private readonly CvTheme _theme;
        private SKCanvas? _canvas;
        private float _y;

        public PageWriter(SKDocument document, CvTheme theme)
        {
            _document = document;
            _theme = theme;
            NewPage();
        }

        private bool Centered => _theme.Layout is "classic" or "executive" or "elegant";

        public void HeaderRule()
        {
            if (_theme.Layout is not ("modern" or "executive")) return;
            Line(_theme.Accent, _theme.Layout == "modern" ? 5f : 2.5f);
            Space(6);
        }

        public void Avatar(byte[] bytes)
        {
            using var bitmap = SKBitmap.Decode(bytes);
            if (bitmap == null || bitmap.Width <= 0 || bitmap.Height <= 0) return;

            const float size = 70f;
            EnsureRoom(size + 10);
            var x = Centered ? (PageWidth - size) / 2 : Margin;
            var destination = SKRect.Create(x, _y, size, size);
            var sourceSize = Math.Min(bitmap.Width, bitmap.Height);
            var source = SKRect.Create(
                (bitmap.Width - sourceSize) / 2f,
                (bitmap.Height - sourceSize) / 2f,
                sourceSize,
                sourceSize);

            using var image = SKImage.FromBitmap(bitmap);
            using var path = new SKPath();
            using var paint = new SKPaint { IsAntialias = true, FilterQuality = SKFilterQuality.High };
            path.AddCircle(destination.MidX, destination.MidY, size / 2);
            _canvas!.Save();
            _canvas.ClipPath(path, antialias: true);
            _canvas.DrawImage(image, source, destination, paint);
            _canvas.Restore();

            using var border = new SKPaint
            {
                Color = _theme.Accent,
                IsAntialias = true,
                Style = SKPaintStyle.Stroke,
                StrokeWidth = 2f
            };
            _canvas.DrawCircle(destination.MidX, destination.MidY, size / 2, border);
            _y += size + 10;
        }

        public void Title(string text) => Write(text, 22, _theme.Accent, bold: true, spacingAfter: 4, centered: Centered);

        public void Subtitle(string text) => Write(text, 13, SKColors.DimGray, bold: false, spacingAfter: 4, centered: Centered);

        public void Section(string text)
        {
            Space(10);
            var color = _theme.Layout == "minimal" ? new SKColor(0x22, 0x22, 0x22) : _theme.Accent;
            Write(text.ToUpperInvariant(), 11.5f, color, bold: true, spacingAfter: 2,
                centered: _theme.Layout is "executive" or "elegant");
            if (_theme.Layout != "minimal") Line(_theme.Accent, _theme.Layout == "modern" ? 1.4f : 0.8f);
            Space(4);
        }

        public void ItemTitle(string text) => Write(text, 11, SKColors.Black, bold: true, spacingAfter: 1);

        public void Body(string text, bool muted = false) =>
            Write(text, 10, muted ? SKColors.Gray : new SKColor(0x22, 0x22, 0x22), bold: false, spacingAfter: 2);

        public void Contact(string text) =>
            Write(text, 10, SKColors.Gray, bold: false, spacingAfter: 2, centered: Centered);

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

        private void Space(float points) => _y += points * _theme.Scale;

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

        private void Write(string text, float size, SKColor color, bool bold, float spacingAfter, bool centered = false)
        {
            using var font = new SKFont(_theme.Typeface, size * _theme.Scale) { Embolden = bold, Subpixel = true };
            using var paint = new SKPaint { Color = color, IsAntialias = true };
            var lineHeight = font.Spacing * 1.15f;
            var maxWidth = PageWidth - 2 * Margin;
            foreach (var paragraph in text.Replace("\r\n", "\n").Split('\n'))
            {
                foreach (var line in Wrap(paragraph, font, maxWidth))
                {
                    EnsureRoom(lineHeight);
                    _y += lineHeight;
                    _canvas!.DrawText(
                        line,
                        centered ? PageWidth / 2 : Margin,
                        _y - font.Metrics.Descent,
                        centered ? SKTextAlign.Center : SKTextAlign.Left,
                        font,
                        paint);
                }
            }

            _y += spacingAfter * _theme.Scale;
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
