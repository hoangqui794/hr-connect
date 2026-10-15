using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Models;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using System.Text;
using Xunit;

namespace HRConnect.UnitTests.Services.Storage;

public class PdfCvValidatorTests
{
    [Fact]
    public void Validate_WithOrdinaryPdf_AcceptsDocument()
    {
        var validator = CreateValidator();

        validator.Validate(BuildPdf());
    }

    [Fact]
    public void Validate_WithObjectStreamAndXrefStream_AcceptsDocument()
    {
        var validator = CreateValidator();

        validator.Validate(BuildObjectStreamPdf(includeJavaScriptAction: false));
    }

    [Fact]
    public void Validate_WhenJavaScriptActionIsInsideObjectStream_RejectsDocument()
    {
        var validator = CreateValidator();

        var rejection = CaptureRejection(
            validator,
            BuildObjectStreamPdf(includeJavaScriptAction: true));

        rejection.ErrorCode.Should().Be("PDF_ACTIVE_CONTENT");
    }

    [Fact]
    public void Validate_WhenStreamTextContainsPdfKeywords_DoesNotTreatTextAsActiveContent()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(content: "Candidate wrote /JS and /OpenAction in a resume.");

        validator.Validate(pdf);
    }

    [Fact]
    public void Validate_WithInternalDestinationOpenAction_AcceptsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(catalogExtra: "/OpenAction [3 0 R /Fit]");

        validator.Validate(pdf);
    }

    [Fact]
    public void Validate_WithInternalGoToOpenAction_AcceptsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/OpenAction 5 0 R",
            extraObjects: ["<< /Type /Action /S /GoTo /D [3 0 R /Fit] >>"]);

        validator.Validate(pdf);
    }

    [Fact]
    public void Validate_WithUriLinkAction_AcceptsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/A 5 0 R",
            extraObjects: ["<< /Type /Action /S /URI /URI (https://hrconnectvn.online) >>"]);

        validator.Validate(pdf);
    }

    [Theory]
    [InlineData("https://github.com/hrconnect")]
    [InlineData("http://portfolio.example.com")]
    [InlineData("mailto:candidate@example.com")]
    [InlineData("tel:+84900000000")]
    public void Validate_WithCommonCandidateLinkSchemes_AcceptsDocument(string uri)
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            pageExtra: "/Annots [5 0 R]",
            extraObjects: [$"<< /Type /Annot /Subtype /Link /A << /S /URI /URI ({uri}) >> >>"]);

        validator.Validate(pdf);
    }

    [Theory]
    [InlineData("javascript:alert")]
    [InlineData("file:///etc/passwd")]
    [InlineData("data:text/html,unsafe")]
    [InlineData("vbscript:unsafe")]
    public void Validate_WithUnsafeUriScheme_RejectsDocument(string uri)
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            pageExtra: "/Annots [5 0 R]",
            extraObjects: [$"<< /Type /Annot /Subtype /Link /A << /S /URI /URI ({uri}) >> >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_ACTIVE_CONTENT");
    }

    [Fact]
    public void Validate_WhenLinkAnnotationUsesJavaScriptActionWithoutType_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            pageExtra: "/Annots [5 0 R]",
            extraObjects: ["<< /Type /Annot /Subtype /Link /A << /S /JavaScript /JS (alert) >> >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_ACTIVE_CONTENT");
    }

    [Fact]
    public void Validate_WhenTaggedPdfUsesAForStructureAttributes_AcceptsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/StructTreeRoot 5 0 R",
            extraObjects:
            [
                "<< /Type /StructTreeRoot /K 6 0 R >>",
                "<< /Type /StructElem /S /P /A [7 0 R 0] >>",
                "<< /O /Layout /TextAlign /Start >>"
            ]);

        validator.Validate(pdf);
    }

    [Fact]
    public void Validate_WhenLargePageResourcesArePresent_DoesNotScanPresentationGraph()
    {
        var validator = CreateValidator();
        var largeResourceArray = string.Join(' ', Enumerable.Repeat("0", 10_001));
        var pdf = BuildPdf(
            pageExtra: "/Resources 5 0 R",
            extraObjects: [$"<< /ProcSet [{largeResourceArray}] >>"]);

        validator.Validate(pdf);
    }

    [Theory]
    [InlineData("JavaScript")]
    [InlineData("Launch")]
    [InlineData("GoToR")]
    [InlineData("SubmitForm")]
    [InlineData("ImportData")]
    [InlineData("Rendition")]
    [InlineData("Sound")]
    [InlineData("Movie")]
    [InlineData("MadeUpAction")]
    public void Validate_WithUnsafeAction_RejectsDocument(string actionType)
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/A 5 0 R",
            extraObjects: [$"<< /Type /Action /S /{actionType} /JS (alert) >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_ACTIVE_CONTENT");
    }

    [Fact]
    public void Validate_WhenOpenActionUsesExternalUri_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/OpenAction 5 0 R",
            extraObjects: ["<< /Type /Action /S /URI /URI (https://example.com) >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_ACTIVE_CONTENT");
    }

    [Fact]
    public void Validate_WhenAdditionalActionContainsJavaScript_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/AA << /WC 5 0 R >>",
            extraObjects: ["<< /S /JavaScript /JS (alert) >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_ACTIVE_CONTENT");
    }

    [Fact]
    public void Validate_WhenAdditionalActionUsesInternalGoTo_AcceptsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/AA << /WC 5 0 R >>",
            extraObjects: ["<< /S /GoTo /D [3 0 R /Fit] >>"]);

        validator.Validate(pdf);
    }

    [Fact]
    public void Validate_WithEmbeddedFileNameTree_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/Names << /EmbeddedFiles 5 0 R >>",
            extraObjects: ["<< /Names [] >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_EMBEDDED_FILE");
    }

    [Fact]
    public void Validate_WithAssociatedFileOnStructureElement_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/StructTreeRoot 5 0 R",
            extraObjects:
            [
                "<< /Type /StructTreeRoot /K 6 0 R >>",
                "<< /Type /StructElem /S /P /AF [7 0 R] >>",
                "<< /Type /Filespec /F (payload.txt) /EF << /F 8 0 R >> >>",
                "<< /Type /EmbeddedFile /Length 0 >>\nstream\n\nendstream"
            ]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_EMBEDDED_FILE");
    }

    [Fact]
    public void Validate_WithFileAttachmentAnnotation_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            pageExtra: "/Annots [5 0 R]",
            extraObjects: ["<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 1 1] >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_EMBEDDED_FILE");
    }

    [Fact]
    public void Validate_WithRichMediaAnnotation_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            pageExtra: "/Annots [5 0 R]",
            extraObjects: ["<< /Type /Annot /Subtype /RichMedia /Rect [0 0 1 1] >>"]);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_ACTIVE_CONTENT");
    }

    [Fact]
    public void Validate_WhenPageLimitIsExceeded_RejectsDocument()
    {
        var validator = CreateValidator(maxPages: 2);
        var pdf = BuildPdf(pageCount: 3);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_PAGE_LIMIT_EXCEEDED");
    }

    [Fact]
    public void Validate_WithZeroPages_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(pageCount: 0);

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_MALFORMED");
    }

    [Fact]
    public void Validate_WithCyclicIndirectReferences_TerminatesAndAcceptsDocument()
    {
        var validator = CreateValidator();
        var pdf = BuildPdf(
            catalogExtra: "/Cycle 5 0 R",
            extraObjects: ["<< /Back 1 0 R >>"]);

        validator.Validate(pdf);
    }

    [Fact]
    public void Validate_WithDeepIndirectNavigationChain_TerminatesAndAcceptsDocument()
    {
        var validator = CreateValidator();
        const int firstObjectNumber = 5;
        const int chainLength = 40;
        var objects = Enumerable.Range(firstObjectNumber, chainLength)
            .Select(objectNumber => objectNumber == firstObjectNumber + chainLength - 1
                ? "<< /End true >>"
                : $"<< /NextNode {objectNumber + 1} 0 R >>")
            .ToArray();
        var pdf = BuildPdf(
            catalogExtra: $"/Deep {firstObjectNumber} 0 R",
            extraObjects: objects);

        validator.Validate(pdf);
    }

    [Fact]
    public void Validate_WhenNodeBudgetIsExceeded_RejectsDocument()
    {
        var validator = CreateValidator();
        var oversizedArray = string.Join(' ', Enumerable.Repeat("0", 10_001));
        var pdf = BuildPdf(catalogExtra: $"/Oversized [{oversizedArray}]");

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_TRAVERSAL_LIMIT");
    }

    [Fact]
    public void Validate_WithTruncatedPdf_RejectsDocument()
    {
        var validator = CreateValidator();
        var pdf = Encoding.ASCII.GetBytes("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj");

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_MALFORMED");
    }

    [Fact]
    public void Validate_WhenRenamedTextFileLooksLikePdf_RejectsDocument()
    {
        var validator = CreateValidator();
        var fakePdf = Encoding.ASCII.GetBytes("This is plain text, not a PDF. %%EOF");

        var rejection = CaptureRejection(validator, fakePdf);

        rejection.ErrorCode.Should().Be("PDF_MALFORMED");
    }

    [Fact]
    public void Validate_WithEncryptedDocument_RejectsDocument()
    {
        var validator = CreateValidator();
        var ownerKey = new string('0', 64);
        var userKey = new string('1', 64);
        var documentId = new string('2', 32);
        var pdf = BuildPdf(
            extraObjects:
            [
                $"<< /Filter /Standard /V 1 /R 2 /Length 40 /O <{ownerKey}> /U <{userKey}> /P -4 >>"
            ],
            trailerExtra: $"/Encrypt 5 0 R /ID [<{documentId}><{documentId}>]");

        var rejection = CaptureRejection(validator, pdf);

        rejection.ErrorCode.Should().Be("PDF_ENCRYPTED");
    }

    private static BadRequestException CaptureRejection(PdfCvValidator validator, byte[] pdf)
    {
        try
        {
            validator.Validate(pdf);
        }
        catch (BadRequestException exception)
        {
            return exception;
        }

        throw new Xunit.Sdk.XunitException("Expected PDF validation to reject the document.");
    }

    private static PdfCvValidator CreateValidator(int maxPages = 30) =>
        new(
            Options.Create(new R2Settings { MaxCvPdfPages = maxPages }),
            NullLogger<PdfCvValidator>.Instance);

    private static byte[] BuildPdf(
        string catalogExtra = "",
        string pageExtra = "",
        int pageCount = 1,
        string content = "",
        IReadOnlyList<string>? extraObjects = null,
        string trailerExtra = "")
    {
        var contentBytes = Encoding.ASCII.GetBytes(content);
        var contentObjectNumber = pageCount + 3;
        var objects = new List<string>
        {
            $"<< /Type /Catalog /Pages 2 0 R {catalogExtra} >>",
            $"<< /Type /Pages /Kids [{string.Join(' ', Enumerable.Range(0, pageCount).Select(index => $"{index + 3} 0 R"))}] /Count {pageCount} >>"
        };

        for (var index = 0; index < pageCount; index++)
        {
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {contentObjectNumber} 0 R {pageExtra} >>");
        }

        objects.Add($"<< /Length {contentBytes.Length} >>\nstream\n{content}\nendstream");
        if (extraObjects is not null)
        {
            objects.AddRange(extraObjects);
        }

        var builder = new StringBuilder("%PDF-1.7\n");
        var offsets = new List<int> { 0 };
        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(builder.ToString()));
            builder.Append(index + 1).Append(" 0 obj\n")
                .Append(objects[index]).Append("\nendobj\n");
        }

        var xrefOffset = Encoding.ASCII.GetByteCount(builder.ToString());
        builder.Append("xref\n0 ").Append(objects.Count + 1)
            .Append("\n0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1))
        {
            builder.Append(offset.ToString("D10")).Append(" 00000 n \n");
        }

        builder.Append("trailer\n<< /Size ").Append(objects.Count + 1)
            .Append(" /Root 1 0 R ").Append(trailerExtra).Append(" >>\nstartxref\n")
            .Append(xrefOffset)
            .Append("\n%%EOF\n");

        return Encoding.ASCII.GetBytes(builder.ToString());
    }

    private static byte[] BuildObjectStreamPdf(bool includeJavaScriptAction)
    {
        var compressedObjects = new[]
        {
            includeJavaScriptAction
                ? "<< /Type /Catalog /Pages 2 0 R /OpenAction 5 0 R >>"
                : "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>",
            includeJavaScriptAction
                ? "<< /Type /Action /S /JavaScript /JS (alert) >>"
                : "<< /Producer (HR Connect test fixture) >>"
        };

        var objectBody = new StringBuilder();
        var objectOffsets = new List<int>();
        foreach (var item in compressedObjects)
        {
            objectOffsets.Add(Encoding.ASCII.GetByteCount(objectBody.ToString()));
            objectBody.Append(item).Append(' ');
        }

        var objectHeader = string.Join(
            ' ',
            compressedObjects.Select((_, index) => $"{index + 1} {objectOffsets[index]}")) + " ";
        var objectStreamData = objectHeader + objectBody;

        using var output = new MemoryStream();
        WriteAscii(output, "%PDF-1.7\n%ObjectStreamFixture\n");

        var contentOffset = checked((int)output.Position);
        WriteAscii(output, "6 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n");

        var objectStreamOffset = checked((int)output.Position);
        WriteAscii(
            output,
            $"7 0 obj\n<< /Type /ObjStm /N {compressedObjects.Length} /First {Encoding.ASCII.GetByteCount(objectHeader)} /Length {Encoding.ASCII.GetByteCount(objectStreamData)} >>\nstream\n{objectStreamData}\nendstream\nendobj\n");

        var xrefOffset = checked((int)output.Position);
        using var xref = new MemoryStream();
        WriteXrefEntry(xref, 0, 0, 65_535);
        for (var index = 0; index < compressedObjects.Length; index++)
        {
            WriteXrefEntry(xref, 2, 7, index);
        }
        WriteXrefEntry(xref, 1, contentOffset, 0);
        WriteXrefEntry(xref, 1, objectStreamOffset, 0);
        WriteXrefEntry(xref, 1, xrefOffset, 0);
        var xrefBytes = xref.ToArray();

        WriteAscii(
            output,
            $"8 0 obj\n<< /Type /XRef /Size 9 /Root 1 0 R /W [1 4 2] /Index [0 9] /Length {xrefBytes.Length} >>\nstream\n");
        output.Write(xrefBytes);
        WriteAscii(output, $"\nendstream\nendobj\nstartxref\n{xrefOffset}\n%%EOF\n");

        return output.ToArray();
    }

    private static void WriteXrefEntry(Stream stream, byte type, int field2, int field3)
    {
        stream.WriteByte(type);
        stream.WriteByte((byte)(field2 >> 24));
        stream.WriteByte((byte)(field2 >> 16));
        stream.WriteByte((byte)(field2 >> 8));
        stream.WriteByte((byte)field2);
        stream.WriteByte((byte)(field3 >> 8));
        stream.WriteByte((byte)field3);
    }

    private static void WriteAscii(Stream stream, string value)
    {
        var bytes = Encoding.ASCII.GetBytes(value);
        stream.Write(bytes);
    }
}
