using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.ApplyJob;

public class ApplyJobCommand : IRequest<ApplyJobResponse>
{
    public Guid JobId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }

    [JsonIgnore]
    public IReadOnlyCollection<string> RoleCodes { get; set; } = Array.Empty<string>();

    public Guid? CvId { get; set; }

    [JsonIgnore]
    public Stream? FileStream { get; set; }

    public string? FileName { get; set; }

    public string? ContentType { get; set; }

    public long? FileSizeBytes { get; set; }
}

public class ApplyJobResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Nộp hồ sơ ứng tuyển thành công.";
    public ApplyJobData? Data { get; set; }
}

public class ApplyJobData
{
    public Guid ApplicationId { get; set; }
    public Guid SubmissionId { get; set; }
    public Guid CandidateId { get; set; }
    public Guid JobId { get; set; }
    public Guid CvId { get; set; }
    public string Status { get; set; } = "ACCEPTED";
    public string AiStatus { get; set; } = "PENDING";
    public DateTime AppliedAt { get; set; }
}
