namespace HRConnect.Application.Common.Interfaces;

public interface IAvatarImageProcessor
{
    Task<ProcessedAvatarImage> ProcessAsync(Stream source, CancellationToken cancellationToken = default);
}

public sealed record ProcessedAvatarImage(byte[] Content, string ContentType, string Extension, int Width, int Height)
{
    public Stream OpenReadStream() => new MemoryStream(Content, writable: false);
}
