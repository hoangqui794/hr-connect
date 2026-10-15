using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Diagnostics.CodeAnalysis;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Exceptions;
using UglyToad.PdfPig.Tokens;

namespace HRConnect.Infrastructure.Services.Storage;

public sealed class PdfCvValidator
{
    private const int MaxTraversalDepth = 32;
    private const int MaxVisitedNodes = 10_000;
    private const int ParserMaxStackDepth = 128;

    private static readonly HashSet<string> AllowedActionTypes =
        new(StringComparer.Ordinal) { "GoTo", "URI" };

    private readonly R2Settings _settings;
    private readonly ILogger<PdfCvValidator> _logger;

    public PdfCvValidator(IOptions<R2Settings> options, ILogger<PdfCvValidator> logger)
    {
        _settings = options.Value;
        _logger = logger;
    }

    public void Validate(ReadOnlyMemory<byte> bytes)
    {
        ValidateEnvelope(bytes.Span);

        try
        {
            using var document = PdfDocument.Open(bytes, new ParsingOptions
            {
                UseLenientParsing = false,
                MaxStackDepth = ParserMaxStackDepth
            });

            if (document.IsEncrypted)
            {
                Reject("PDF_ENCRYPTED", "Tài liệu PDF được bảo vệ bằng mật khẩu hoặc mã hóa nên không thể sử dụng.");
            }

            if (document.NumberOfPages <= 0)
            {
                Reject("PDF_MALFORMED", "Tài liệu PDF không có trang nội dung hợp lệ.");
            }

            if (document.NumberOfPages > _settings.MaxCvPdfPages)
            {
                Reject(
                    "PDF_PAGE_LIMIT_EXCEEDED",
                    $"Tài liệu PDF vượt quá giới hạn {_settings.MaxCvPdfPages} trang cho một CV.");
            }

            if (document.Advanced.TryGetEmbeddedFiles(out var embeddedFiles) && embeddedFiles.Count > 0)
            {
                Reject("PDF_EMBEDDED_FILE", "Tài liệu PDF chứa tệp đính kèm không được phép.");
            }

            var context = new TraversalContext(document);
            VisitToken(document.Structure.Catalog.CatalogDictionary, context, 0, TokenContext.General);
        }
        catch (BadRequestException)
        {
            throw;
        }
        catch (PdfDocumentEncryptedException)
        {
            Reject("PDF_ENCRYPTED", "Tài liệu PDF được bảo vệ bằng mật khẩu hoặc mã hóa nên không thể sử dụng.");
        }
        catch (PdfDocumentStackDepthException)
        {
            Reject("PDF_TRAVERSAL_LIMIT", "Cấu trúc tài liệu PDF quá phức tạp để xử lý an toàn.");
        }
        catch (PdfDocumentFormatException)
        {
            Reject("PDF_MALFORMED", "Tài liệu PDF bị hỏng hoặc không đúng định dạng.");
        }
    }

    private void ValidateEnvelope(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 8 || !bytes.StartsWith("%PDF-"u8))
        {
            Reject("PDF_MALFORMED", "Nội dung tập tin không phải là tài liệu PDF hợp lệ.");
        }

        var version = bytes.Slice(5, Math.Min(3, bytes.Length - 5));
        if (version.Length != 3 ||
            (version[0] != (byte)'1' && version[0] != (byte)'2') ||
            version[1] != (byte)'.' ||
            version[2] is < (byte)'0' or > (byte)'9')
        {
            Reject("PDF_MALFORMED", "Phiên bản tài liệu PDF không hợp lệ.");
        }

        var tail = bytes[^Math.Min(bytes.Length, 65_536)..];
        if (tail.LastIndexOf("%%EOF"u8) < 0)
        {
            Reject("PDF_MALFORMED", "Tài liệu PDF bị hỏng hoặc chưa được ghi hoàn chỉnh.");
        }
    }

    private void VisitToken(
        IToken token,
        TraversalContext context,
        int depth,
        TokenContext tokenContext)
    {
        context.VisitedNodes++;
        if (depth > MaxTraversalDepth || context.VisitedNodes > MaxVisitedNodes)
        {
            Reject("PDF_TRAVERSAL_LIMIT", "Cấu trúc tài liệu PDF quá phức tạp để xử lý an toàn.");
        }

        switch (token)
        {
            case IndirectReferenceToken referenceToken:
                if (context.VisitedReferences.Add((referenceToken.Data, tokenContext)))
                {
                    VisitToken(
                        context.Document.Structure.GetObject(referenceToken.Data).Data,
                        context,
                        depth + 1,
                        tokenContext);
                }
                break;

            case DictionaryToken dictionary:
                ValidateDictionary(dictionary, context, depth, tokenContext);
                break;

            case ArrayToken array:
                var itemContext = tokenContext == TokenContext.OpenAction
                    ? TokenContext.General
                    : tokenContext;
                foreach (var item in array.Data)
                {
                    VisitToken(item, context, depth + 1, itemContext);
                }
                break;

            case StreamToken stream:
                VisitToken(stream.StreamDictionary, context, depth + 1, tokenContext);
                break;
        }
    }

    private void ValidateDictionary(
        DictionaryToken dictionary,
        TraversalContext context,
        int depth,
        TokenContext tokenContext)
    {
        var typeName = GetName(dictionary, "Type");
        var subtypeName = GetName(dictionary, "Subtype");

        if (typeName == "EmbeddedFile" || dictionary.Data.ContainsKey("EmbeddedFiles") ||
            (typeName == "Filespec" && dictionary.Data.ContainsKey("EF")))
        {
            Reject("PDF_EMBEDDED_FILE", "Tài liệu PDF chứa tệp đính kèm không được phép.");
        }

        if (subtypeName is "FileAttachment")
        {
            Reject("PDF_EMBEDDED_FILE", "Tài liệu PDF chứa tệp đính kèm không được phép.");
        }

        if (subtypeName is "RichMedia" || typeName is "RichMedia")
        {
            Reject("PDF_ACTIVE_CONTENT", "Tài liệu PDF chứa nội dung đa phương tiện chủ động không được phép.");
        }

        if (dictionary.Data.ContainsKey("JavaScript"))
        {
            Reject("PDF_ACTIVE_CONTENT", "Tài liệu PDF chứa mã JavaScript không được phép.");
        }

        if (tokenContext is TokenContext.Action or TokenContext.OpenAction || typeName == "Action")
        {
            ValidateAction(dictionary, tokenContext == TokenContext.OpenAction);
        }

        foreach (var pair in dictionary.Data)
        {
            var childContext = pair.Key switch
            {
                "OpenAction" => TokenContext.OpenAction,
                "A" or "Next" => TokenContext.Action,
                "AA" => TokenContext.AdditionalActions,
                _ when tokenContext == TokenContext.AdditionalActions => TokenContext.Action,
                _ => TokenContext.General
            };

            if (pair.Key == "OpenAction" && pair.Value is ArrayToken or NameToken)
            {
                VisitToken(pair.Value, context, depth + 1, TokenContext.General);
                continue;
            }

            VisitToken(pair.Value, context, depth + 1, childContext);
        }
    }

    private void ValidateAction(DictionaryToken dictionary, bool isOpenAction)
    {
        if (!dictionary.Data.TryGetValue("S", out var actionToken))
        {
            Reject("PDF_ACTIVE_CONTENT", "Tài liệu PDF chứa hành động không xác định nên không thể xử lý an toàn.");
        }

        var actionName = actionToken as NameToken;
        if (actionName is null)
        {
            Reject("PDF_ACTIVE_CONTENT", "Tài liệu PDF chứa hành động không xác định nên không thể xử lý an toàn.");
        }

        var actionType = actionName?.Data ?? string.Empty;
        if (!AllowedActionTypes.Contains(actionType) || (isOpenAction && actionType != "GoTo"))
        {
            Reject("PDF_ACTIVE_CONTENT", "Tài liệu PDF chứa hành động chủ động không được phép.");
        }
    }

    private static string? GetName(DictionaryToken dictionary, string key) =>
        dictionary.Data.TryGetValue(key, out var value) && value is NameToken name ? name.Data : null;

    [DoesNotReturn]
    private void Reject(string errorCode, string message)
    {
        _logger.LogWarning("CV PDF validation rejected: {ReasonCode}", errorCode);
        throw new BadRequestException(message, errorCode);
    }

    private sealed class TraversalContext(PdfDocument document)
    {
        public PdfDocument Document { get; } = document;
        public HashSet<(IndirectReference Reference, TokenContext Context)> VisitedReferences { get; } = [];
        public int VisitedNodes { get; set; }
    }

    private enum TokenContext
    {
        General,
        Action,
        OpenAction,
        AdditionalActions
    }
}
