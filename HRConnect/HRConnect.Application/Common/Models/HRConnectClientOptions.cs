namespace HRConnect.Application.Common.Models;

public class HRConnectClientOptions
{
    public const string SectionName = "HRConnectClient";

    /// <summary>
    /// Base URL of HRConnect backend (e.g. http://localhost:5041 or configured via HRCONNECT_BASE_URL).
    /// </summary>
    public string BaseUrl { get; set; } = "http://localhost:5041";

    /// <summary>
    /// Service token for internal service-to-service authentication (configured via HRCONNECT_SERVICE_TOKEN).
    /// </summary>
    public string ServiceToken { get; set; } = string.Empty;

    /// <summary>
    /// Default expiry time in minutes for temporary presigned URLs requested by internal services (default 15 minutes).
    /// </summary>
    public int DefaultExpiryMinutes { get; set; } = 15;

    /// <summary>
    /// Maximum retries when refreshing an expired presigned URL during PDF download.
    /// </summary>
    public int MaxRetries { get; set; } = 2;
}
