namespace HRConnect.Application.Common.Models;

public sealed class Mf03IntegrationSettings
{
    public const string SectionName = "Mf03Integration";

    public string BaseUrl { get; set; } = "http://127.0.0.1:8001";
    public string ServiceToken { get; set; } = string.Empty;
    public int PollIntervalSeconds { get; set; } = 5;
    public int ProcessingTimeoutMinutes { get; set; } = 15;
    public int BatchSize { get; set; } = 10;
}
