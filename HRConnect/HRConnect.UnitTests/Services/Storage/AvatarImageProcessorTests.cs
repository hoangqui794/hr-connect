using HRConnect.Application.Common.Models;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace HRConnect.UnitTests.Services.Storage;

public sealed class AvatarImageProcessorTests
{
    [Fact]
    public async Task ProcessAsync_ValidPng_NormalizesToBoundedWebp()
    {
        var processor = CreateProcessor(outputSize: 128);
        using var bitmap = new SKBitmap(400, 200);
        bitmap.Erase(SKColors.CornflowerBlue);
        using var image = SKImage.FromBitmap(bitmap);
        using var png = image.Encode(SKEncodedImageFormat.Png, 100);
        await using var input = new MemoryStream(png.ToArray());

        var result = await processor.ProcessAsync(input);

        Assert.Equal("image/webp", result.ContentType);
        Assert.Equal(".webp", result.Extension);
        Assert.Equal(128, result.Width);
        Assert.Equal(64, result.Height);
        using var decoded = SKCodec.Create(new MemoryStream(result.Content));
        Assert.NotNull(decoded);
        Assert.Equal(SKEncodedImageFormat.Webp, decoded!.EncodedFormat);
    }

    [Fact]
    public async Task ProcessAsync_FakeImage_RejectsContent()
    {
        var processor = CreateProcessor();
        await using var input = new MemoryStream("not an image"u8.ToArray());

        await Assert.ThrowsAsync<InvalidDataException>(() => processor.ProcessAsync(input));
    }

    [Fact]
    public async Task ProcessAsync_TooManyPixels_RejectsBeforeDecode()
    {
        var processor = CreateProcessor(maxPixels: 10_000);
        using var bitmap = new SKBitmap(200, 100);
        bitmap.Erase(SKColors.White);
        using var image = SKImage.FromBitmap(bitmap);
        using var png = image.Encode(SKEncodedImageFormat.Png, 100);
        await using var input = new MemoryStream(png.ToArray());

        await Assert.ThrowsAsync<InvalidDataException>(() => processor.ProcessAsync(input));
    }

    private static AvatarImageProcessor CreateProcessor(int outputSize = 1024, long maxPixels = 16_000_000) =>
        new(Options.Create(new R2Settings
        {
            AvatarOutputSize = outputSize,
            MaxAvatarWidth = 4096,
            MaxAvatarHeight = 4096,
            MaxAvatarPixels = maxPixels,
            AvatarWebpQuality = 85
        }));
}
