using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;

public class SubmitCandidateCommand : IRequest<SubmitCandidateResponse>
{
    public Guid JobId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }

    [JsonIgnore]
    public IReadOnlyCollection<string> RoleCodes { get; set; } = Array.Empty<string>();

    public string FullName { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public Guid? CvId { get; set; }

    [JsonIgnore]
    public Stream? FileStream { get; set; }

    public string? FileName { get; set; }

    public string? ContentType { get; set; }

    public long? FileSizeBytes { get; set; }

    public string? Note { get; set; }
}

public class SubmitCandidateResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Nộp ứng viên thành công.";
    public SubmitCandidateData? Data { get; set; }
}

public class SubmitCandidateData
{
    public Guid ApplicationId { get; set; }
    public Guid SubmissionId { get; set; }
    public Guid AttributionId { get; set; }
    public Guid AffiliateId { get; set; }
    public Guid CandidateId { get; set; }
    public Guid JobId { get; set; }
    public Guid CvId { get; set; }
    public string Status { get; set; } = "ACCEPTED";
    public string AiStatus { get; set; } = "PENDING";
    public DateTime SubmittedAt { get; set; }
}
