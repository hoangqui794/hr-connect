using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Users.Commands.UploadAvatar;

public class UploadAvatarCommand : IRequest<UploadAvatarResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    [JsonIgnore]
    public Stream FileStream { get; set; } = Stream.Null;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long FileSizeBytes { get; set; }
}

public class UploadAvatarResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Tải lên ảnh đại diện thành công.";
    public UploadAvatarData? Data { get; set; }
}

public class UploadAvatarData
{
    public Guid UserId { get; set; }
    public string AvatarUrl { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
