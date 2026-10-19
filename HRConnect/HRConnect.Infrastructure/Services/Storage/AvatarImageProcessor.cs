using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace HRConnect.Infrastructure.Services.Storage;

public sealed class AvatarImageProcessor(IOptions<R2Settings> options) : IAvatarImageProcessor
{
    private readonly R2Settings _settings = options.Value;

    public async Task<ProcessedAvatarImage> ProcessAsync(Stream source, CancellationToken cancellationToken = default)
    {
        if (!source.CanRead)
            throw new InvalidDataException("Không thể đọc dữ liệu ảnh đại diện.");

        await using var buffer = new MemoryStream();
        if (source.CanSeek) source.Position = 0;
        await source.CopyToAsync(buffer, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();

        using var data = SKData.CreateCopy(buffer.ToArray());
        using var codec = SKCodec.Create(data) ?? throw new InvalidDataException("Tập tin không phải là ảnh hợp lệ.");
        if (codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
            throw new NotSupportedException("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");

        var info = codec.Info;
        var pixels = (long)info.Width * info.Height;
        if (info.Width <= 0 || info.Height <= 0 ||
            info.Width > _settings.MaxAvatarWidth || info.Height > _settings.MaxAvatarHeight ||
            pixels > _settings.MaxAvatarPixels)
            throw new InvalidDataException("Kích thước hoặc độ phân giải ảnh vượt quá giới hạn cho phép.");

        using var decoded = new SKBitmap(info.Width, info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
        var decodeResult = codec.GetPixels(decoded.Info, decoded.GetPixels());
        if (decodeResult is not (SKCodecResult.Success or SKCodecResult.IncompleteInput))
            throw new InvalidDataException("Không thể giải mã ảnh đại diện.");
        if (decodeResult == SKCodecResult.IncompleteInput)
            throw new InvalidDataException("Tập tin ảnh bị hỏng hoặc chưa tải lên đầy đủ.");

        using var oriented = Orient(decoded, codec.EncodedOrigin);
        var scale = Math.Min(1d, Math.Min(
            (double)_settings.AvatarOutputSize / oriented.Width,
            (double)_settings.AvatarOutputSize / oriented.Height));
        var width = Math.Max(1, (int)Math.Round(oriented.Width * scale));
        var height = Math.Max(1, (int)Math.Round(oriented.Height * scale));
        using var normalized = new SKBitmap(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
        using (var sourcePixels = oriented.PeekPixels())
        using (var targetPixels = normalized.PeekPixels())
        {
            if (!sourcePixels.ScalePixels(targetPixels, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear)))
                throw new InvalidDataException("Không thể thay đổi kích thước ảnh đại diện.");
        }

        using var image = SKImage.FromBitmap(normalized);
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, _settings.AvatarWebpQuality)
            ?? throw new InvalidDataException("Không thể chuẩn hóa ảnh đại diện.");
        return new ProcessedAvatarImage(encoded.ToArray(), "image/webp", ".webp", width, height);
    }

    private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var target = new SKBitmap(swap ? source.Height : source.Width, swap ? source.Width : source.Height,
            SKColorType.Rgba8888, SKAlphaType.Premul);
        using var canvas = new SKCanvas(target);
        switch (origin)
        {
            case SKEncodedOrigin.TopRight:
                canvas.Translate(target.Width, 0); canvas.Scale(-1, 1); break;
            case SKEncodedOrigin.BottomRight:
                canvas.Translate(target.Width, target.Height); canvas.RotateDegrees(180); break;
            case SKEncodedOrigin.BottomLeft:
                canvas.Translate(0, target.Height); canvas.Scale(1, -1); break;
            case SKEncodedOrigin.LeftTop:
                canvas.Scale(-1, 1); canvas.RotateDegrees(-90); break;
            case SKEncodedOrigin.RightTop:
                canvas.Translate(target.Width, 0); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.RightBottom:
                canvas.Translate(target.Width, target.Height); canvas.Scale(-1, 1); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.LeftBottom:
                canvas.Translate(0, target.Height); canvas.RotateDegrees(-90); break;
        }
        canvas.DrawBitmap(source, 0, 0);
        canvas.Flush();
        return target;
    }
}
