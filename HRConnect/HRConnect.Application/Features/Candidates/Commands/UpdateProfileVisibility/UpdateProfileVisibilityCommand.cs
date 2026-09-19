using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateProfileVisibility;

public class UpdateProfileVisibilityCommand : IRequest<UpdateProfileVisibilityResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public string Visibility { get; set; } = string.Empty;
}

public class UpdateProfileVisibilityResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật chế độ hiển thị hồ sơ thành công.";
    public UpdateProfileVisibilityData? Data { get; set; }
}

public class UpdateProfileVisibilityData
{
    public Guid CandidateId { get; set; }
    public Guid? UserId { get; set; }
    public string ProfileVisibility { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
