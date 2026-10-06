using MediatR;
using System.Text.Json.Serialization;

namespace HRConnect.Application.Features.SubmissionConsents.RespondSubmissionConsent;

public sealed class RespondSubmissionConsentCommand : IRequest<RespondSubmissionConsentResponse>
{
    public string Token { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public bool? AllowFutureReuse { get; set; }
    [JsonIgnore] public Guid? SubmissionId { get; set; }
    [JsonIgnore] public Guid? RequesterUserId { get; set; }
    [JsonIgnore] public string? IpAddress { get; set; }
    [JsonIgnore] public string? UserAgent { get; set; }
}

public sealed class RespondSubmissionConsentResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = null!;
    public Guid SubmissionId { get; set; }
    public string SubmissionStatus { get; set; } = null!;
    public Guid? ApplicationId { get; set; }
    public string AiStatus { get; set; } = "NOT_QUEUED";
    public string? AffiliateReuseStatus { get; set; }
    public Guid? ReuseConcurrencyToken { get; set; }
}
