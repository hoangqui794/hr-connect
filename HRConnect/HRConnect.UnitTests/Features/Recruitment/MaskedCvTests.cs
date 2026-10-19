using FluentAssertions;
using HRConnect.Application.Features.Candidates.CvBuilder;
using HRConnect.Application.Features.Recruitment.Queries.GetApplicationMaskedCv;
using HRConnect.Infrastructure.Services.CvBuilder;
using UglyToad.PdfPig;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

/// <summary>N16: Client sees a Headhunt CV with email, phone and links hidden.</summary>
public class MaskedCvTests
{
    [Theory]
    [InlineData("Email: hieu.pham@example.com", "Email: [đã ẩn]")]
    [InlineData("SĐT: 0901 234 567", "SĐT: [đã ẩn]")]
    [InlineData("Phone +84 901.234.567", "Phone [đã ẩn]")]
    [InlineData("linkedin.com/in/hieu và https://github.com/hieu", "[đã ẩn] và [đã ẩn]")]
    [InlineData("2019 - 2022, GPA 3.5, 5 năm kinh nghiệm", "2019 - 2022, GPA 3.5, 5 năm kinh nghiệm")]
    public void Redact_ShouldHideContactButKeepYearsAndNumbers(string input, string expected)
    {
        CvRedactor.Redact(input).Should().Be(expected);
    }

    [Fact]
    public void MaskedCopy_OfRealPdf_ShouldKeepContentAndDropContact()
    {
        var renderer = new CvPdfRenderer();
        var original = renderer.Render(new StructuredCvContent(
            "Phạm Minh Hiếu", "Backend .NET", "hieu@example.com", "0901234567", "Hà Nội",
            "Xây dựng API bằng ASP.NET Core.", [], [], ["C#", "SQL Server"], [], []), null);

        var pages = MaskedCvService.ExtractPages(original)!;
        var masked = renderer.RenderPlain("CV", "đã che", pages.SelectMany(p => p.Split('\n')).Select(CvRedactor.Redact).ToList());

        using var document = PdfDocument.Open(masked);
        var text = string.Join(" ", document.GetPages().Select(p => p.Text));
        text.Should().Contain("ASP.NET").And.Contain("SQL Server");
        text.Should().NotContain("hieu@example.com").And.NotContain("0901234567");
    }
}
