namespace HRConnect.Infrastructure.Services.Integration;

internal static class Mf03RetryPolicy
{
    internal static int NormalizeMaxAttempts(int configuredValue) =>
        Math.Clamp(configuredValue, 1, 20);

    internal static TimeSpan CalculateDelay(
        int completedDispatchCount,
        int initialDelaySeconds,
        int maxDelaySeconds)
    {
        var initial = Math.Clamp(initialDelaySeconds, 1, 3600);
        var maximum = Math.Clamp(maxDelaySeconds, initial, 86400);
        var exponent = Math.Clamp(completedDispatchCount - 1, 0, 30);
        var seconds = Math.Min(maximum, initial * Math.Pow(2, exponent));
        return TimeSpan.FromSeconds(seconds);
    }
}
