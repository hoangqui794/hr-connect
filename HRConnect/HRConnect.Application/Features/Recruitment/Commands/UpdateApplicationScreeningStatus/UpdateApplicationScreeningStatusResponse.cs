namespace HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;

public sealed class UpdateApplicationScreeningStatusResponse
{
    public bool Success { get; init; } = true;

    public string Message { get; init; } = "Đã cập nhật trạng thái sàng lọc hồ sơ.";

    public UpdateApplicationScreeningStatusData Data { get; init; } = new();
}

public sealed class UpdateApplicationScreeningStatusData
{
    public Guid ApplicationId { get; init; }

    public string PreviousStatus { get; init; } = string.Empty;

    public string CurrentStatus { get; init; } = string.Empty;

    public string? Reason { get; init; }

    public string? ReasonCode { get; init; }

    public Guid ConcurrencyToken { get; init; }

    public DateTime UpdatedAt { get; init; }
}
