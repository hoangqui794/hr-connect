namespace HRConnect.Application.Features.Recruitment.Commands.StartScreening;

public sealed class StartScreeningResponse
{
    public bool Success { get; init; } = true;

    public string Message { get; init; } = string.Empty;

    public StartScreeningData Data { get; init; } = new();
}

public sealed class StartScreeningData
{
    public Guid ApplicationId { get; init; }

    public string CurrentStatus { get; init; } = string.Empty;

    /// <summary>False when nothing changed (already past SUBMITTED, or caller is not the screener).</summary>
    public bool Changed { get; init; }

    public Guid ConcurrencyToken { get; init; }
}
