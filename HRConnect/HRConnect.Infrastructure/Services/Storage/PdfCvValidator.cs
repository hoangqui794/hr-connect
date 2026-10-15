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
    private const int MaxVisitedNodes = 10_000;
    private const int ParserMaxStackDepth = 128;

    private static readonly HashSet<string> AllowedActionTypes =
        new(StringComparer.Ordinal) { "GoTo", "URI" };

    private static readonly HashSet<string> AllowedUriSchemes =
        new(StringComparer.OrdinalIgnoreCase) { "http", "https", "mailto", "tel" };

    // These branches describe presentation, accessibility or navigation targets. They cannot
    // execute an action by themselves and can be very large in ordinary Canva/Adobe CVs.
    private static readonly HashSet<string> SkippedTraversalKeys =
        new(StringComparer.Ordinal)
        {
            "StructTreeRoot",
            "Resources",
            "Contents",
            "Metadata",
            "OutputIntents",
            "Dests",
            "Parent",
            "Prev",
            "Last",
            "AP",
            "Thumb",
            "PieceInfo"
        };

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

            ValidateStructureTreeAssociatedFiles(document.Structure.Catalog.CatalogDictionary, document);

            var context = new TraversalContext(document);
            VisitToken(document.Structure.Catalog.CatalogDictionary, context, TokenContext.General);
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
        IToken rootToken,
        TraversalContext context,
        TokenContext rootContext)
    {
        var pending = new Stack<(IToken Token, TokenContext Context)>();
        pending.Push((rootToken, rootContext));

        while (pending.Count > 0)
        {
            var (token, tokenContext) = pending.Pop();
            context.VisitedNodes++;
            if (context.VisitedNodes > MaxVisitedNodes)
            {
                Reject("PDF_TRAVERSAL_LIMIT", "Cấu trúc tài liệu PDF quá phức tạp để xử lý an toàn.");
            }

            switch (token)
            {
                case IndirectReferenceToken referenceToken:
                    if (context.VisitedReferences.Add((referenceToken.Data, tokenContext)))
                    {
                        pending.Push((
                            context.Document.Structure.GetObject(referenceToken.Data).Data,
                            tokenContext));
                    }
                    break;

                case DictionaryToken dictionary:
                    ValidateDictionary(dictionary, tokenContext);
                    PushDictionaryChildren(dictionary, context, tokenContext, pending);
                    break;

                case ArrayToken array:
                    var itemContext = tokenContext == TokenContext.OpenAction
                        ? TokenContext.General
                        : tokenContext;
                    foreach (var item in array.Data)
                    {
                        pending.Push((item, itemContext));
                    }
                    break;

                case StreamToken stream:
                    pending.Push((stream.StreamDictionary, tokenContext));
                    break;
            }
        }
    }

    private void ValidateStructureTreeAssociatedFiles(
        DictionaryToken catalog,
        PdfDocument document)
    {
        if (!catalog.Data.TryGetValue("StructTreeRoot", out var structureRoot))
        {
            return;
        }

        var pending = new Stack<IToken>();
        var visitedReferences = new HashSet<IndirectReference>();
        var visitedNodes = 0;
        pending.Push(structureRoot);

        while (pending.Count > 0)
        {
            var token = pending.Pop();
            visitedNodes++;
            if (visitedNodes > MaxVisitedNodes)
            {
                Reject("PDF_TRAVERSAL_LIMIT", "Cấu trúc tài liệu PDF quá phức tạp để xử lý an toàn.");
            }

            switch (token)
            {
                case IndirectReferenceToken referenceToken:
                    if (visitedReferences.Add(referenceToken.Data))
                    {
                        pending.Push(document.Structure.GetObject(referenceToken.Data).Data);
                    }
                    break;

                case DictionaryToken dictionary:
                    if (dictionary.Data.ContainsKey("AF"))
                    {
                        Reject("PDF_EMBEDDED_FILE", "Tài liệu PDF chứa tệp đính kèm không được phép.");
                    }

                    if (dictionary.Data.TryGetValue("K", out var children))
                    {
                        pending.Push(children);
                    }
                    break;

                case ArrayToken array:
                    foreach (var item in array.Data)
                    {
                        pending.Push(item);
                    }
                    break;
            }
        }
    }

    private void ValidateDictionary(
        DictionaryToken dictionary,
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

    }

    private void PushDictionaryChildren(
        DictionaryToken dictionary,
        TraversalContext context,
        TokenContext tokenContext,
        Stack<(IToken Token, TokenContext Context)> pending)
    {
        foreach (var pair in dictionary.Data)
        {
            if (SkippedTraversalKeys.Contains(pair.Key) ||
                (tokenContext == TokenContext.Action && pair.Key == "D"))
            {
                continue;
            }

            var childContext = pair.Key switch
            {
                "OpenAction" => TokenContext.OpenAction,
                "A" when IsActionToken(pair.Value, context.Document) => TokenContext.Action,
                "Next" when tokenContext == TokenContext.Action => TokenContext.Action,
                "AA" => TokenContext.AdditionalActions,
                _ when tokenContext == TokenContext.AdditionalActions => TokenContext.Action,
                _ => TokenContext.General
            };

            if (pair.Key == "OpenAction" && pair.Value is ArrayToken or NameToken)
            {
                pending.Push((pair.Value, TokenContext.General));
                continue;
            }

            pending.Push((pair.Value, childContext));
        }
    }

    private static bool IsActionToken(IToken token, PdfDocument document)
    {
        var resolved = token switch
        {
            DictionaryToken dictionary => dictionary,
            IndirectReferenceToken reference =>
                document.Structure.GetObject(reference.Data).Data as DictionaryToken,
            _ => null
        };

        return resolved is not null &&
               (GetName(resolved, "S") is not null || GetName(resolved, "Type") == "Action");
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

        if (actionType == "URI")
        {
            ValidateUriAction(dictionary);
        }
    }

    private void ValidateUriAction(DictionaryToken dictionary)
    {
        if (!dictionary.Data.TryGetValue("URI", out var uriToken))
        {
            Reject("PDF_ACTIVE_CONTENT", "Tài liệu PDF chứa liên kết không hợp lệ.");
        }

        var value = uriToken switch
        {
            StringToken stringToken => stringToken.Data,
            HexToken hexToken => hexToken.Data,
            _ => null
        };

        if (string.IsNullOrWhiteSpace(value) ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            !AllowedUriSchemes.Contains(uri.Scheme))
        {
            Reject("PDF_ACTIVE_CONTENT", "Tài liệu PDF chứa liên kết không an toàn hoặc không được hỗ trợ.");
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
