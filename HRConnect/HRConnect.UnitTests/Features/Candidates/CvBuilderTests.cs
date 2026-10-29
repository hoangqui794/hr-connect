using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.CvBuilder;
using HRConnect.Infrastructure.Services.CvBuilder;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SkiaSharp;
using UglyToad.PdfPig;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

/// <summary>BE-04 B: a built CV is a readable text PDF that passes the same checks as an uploaded CV.</summary>
public class CvBuilderTests
{
    private static StructuredCvContent Sample(int experiences = 1) => new(
        "Phạm Minh Hiếu", "Lập trình viên Backend .NET", "hieu@example.com", "0901234567", "Hà Nội",
        "Mong muốn phát triển hệ thống API hiệu năng cao bằng ASP.NET Core.",
        Enumerable.Range(1, experiences).Select(i => new CvExperience(
            "Kỹ sư phần mềm", $"Công ty {i}", "2022", "2024",
            "Xây dựng RESTful API bằng ASP.NET Core, tối ưu truy vấn SQL Server, viết unit test.")).ToList(),
        [new CvEducation("Đại học Bách khoa", "Kỹ sư CNTT", "2017", "2022", null)],
        ["C#", "ASP.NET Core", "SQL Server", "Docker"], ["Tiếng Anh (IELTS 6.5)"], ["AWS Cloud Practitioner"]);

    [Theory]
    [InlineData(null)]
    [InlineData("{\"accentColor\":\"#1D4ED8\",\"density\":\"compact\"}")]
    [InlineData("{\"accentColor\":\"#881337\",\"density\":\"spacious\",\"layout\":\"elegant\",\"fontFamily\":\"INTER\"}")]
    [InlineData("not json")]
    public void Render_ShouldProduceReadableVietnamesePdfThatPassesCvChecks(string? templateConfig)
    {
        var pdf = new CvPdfRenderer().Render(Sample(), templateConfig);

        new PdfCvValidator(Options.Create(new R2Settings { MaxCvPdfPages = 30 }), NullLogger<PdfCvValidator>.Instance)
            .Validate(pdf);
        using var document = PdfDocument.Open(pdf);
        var text = string.Join(" ", document.GetPages().Select(p => p.Text));
        text.Should().Contain("Phạm").And.Contain("Hiếu").And.Contain("ASP.NET");
        text.Should().Contain("KINH NGHIỆM");
    }

    [Fact]
    public void Render_LongCv_ShouldFlowOntoMorePages()
    {
        var pdf = new CvPdfRenderer().Render(Sample(experiences: 25), null);

        using var document = PdfDocument.Open(pdf);
        document.NumberOfPages.Should().BeGreaterThan(1);
    }

    [Fact]
    public void Render_ShouldRespectSavedPresentationAndVisibleSections()
    {
        var content = Sample() with
        {
            Presentation = new CvPresentation(
                "#172554", "normal", "BE_VIETNAM_PRO", "executive", ["summary", "skills"])
        };

        var pdf = new CvPdfRenderer().Render(content, null);

        using var document = PdfDocument.Open(pdf);
        var text = string.Join(" ", document.GetPages().Select(p => p.Text));
        text.Should().Contain("MỤC TIÊU").And.Contain("KỸ NĂNG");
        text.Should().NotContain("KINH NGHIỆM").And.NotContain("HỌC VẤN");
    }

    [Fact]
    public void Render_WithOptInAvatar_ShouldProduceValidPdf()
    {
        using var bitmap = new SKBitmap(120, 90);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(SKColors.CornflowerBlue);
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 90);
        var content = Sample() with
        {
            Presentation = new CvPresentation(
                "#1D4ED8", "normal", "BE_VIETNAM_PRO", "classic", ["summary", "skills"], ShowAvatar: true)
        };

        var validated = CvBuilderHandlers.Validate(content);
        var pdf = new CvPdfRenderer().Render(validated, null, encoded.ToArray());

        validated.Presentation!.ShowAvatar.Should().BeTrue();
        new PdfCvValidator(Options.Create(new R2Settings { MaxCvPdfPages = 30 }), NullLogger<PdfCvValidator>.Instance)
            .Validate(pdf);
        pdf.Should().StartWith(new byte[] { 0x25, 0x50, 0x44, 0x46 });
    }

    [Fact]
    public void Validate_InvalidPresentation_ShouldBeRejected()
    {
        var content = Sample() with
        {
            Presentation = new CvPresentation("red", "normal", "ROBOTO", "ats", ["summary"])
        };

        var act = () => CvBuilderHandlers.Validate(content);

        act.Should().Throw<BadRequestException>().Which.ErrorCode.Should().Be("CV_PRESENTATION_INVALID");
    }

    [Fact]
    public void Validate_EmptyCv_ShouldBeRejected()
    {
        var empty = new StructuredCvContent("Nguyễn Văn A", null, null, null, null, null, [], [], [], [], []);

        var act = () => CvBuilderHandlers.Validate(empty);

        act.Should().Throw<BadRequestException>().Which.ErrorCode.Should().Be("CV_CONTENT_EMPTY");
    }

    [Fact]
    public void Validate_ShouldTrimAndDropEmptyEntries()
    {
        var content = Sample() with { Skills = ["  C#  ", " ", "SQL"], Experiences = [new CvExperience(" ", null, null, null, null)] };

        var result = CvBuilderHandlers.Validate(content);

        result.Skills.Should().Equal("C#", "SQL");
        result.Experiences.Should().BeEmpty();
    }

    [Fact]
    public void Validate_ProjectOnlyCv_ShouldBeAcceptedAndRendered()
    {
        var content = new StructuredCvContent(
            "Nguyễn Văn A", "Backend Developer", "a@example.com", null, null, null,
            [], [], [], [], [],
            new CvPresentation("#1D4ED8", "normal", "INTER", "modern", ["projects", "activities"]),
            [new CvProject("HR Connect", "Backend Developer", "2026", "Hiện tại", "Xây dựng API tuyển dụng.", ".NET, PostgreSQL", "https://example.com")],
            [new CvActivity("Câu lạc bộ CNTT", "Thành viên", "2025", "2026", "Tổ chức workshop.")]);

        var validated = CvBuilderHandlers.Validate(content);
        var pdf = new CvPdfRenderer().Render(validated, null);
        using var document = PdfDocument.Open(pdf);
        var text = string.Join(" ", document.GetPages().Select(page => page.Text));

        validated.Projects.Should().ContainSingle();
        text.Should().Contain("DỰ ÁN NỔI BẬT").And.Contain("HR Connect").And.Contain("HOẠT ĐỘNG");
    }
}
