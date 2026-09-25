using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Users.Commands.DeleteAvatar;

public class DeleteAvatarCommand : IRequest<DeleteAvatarResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }
}

public class DeleteAvatarResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Xóa ảnh đại diện thành công.";
}
