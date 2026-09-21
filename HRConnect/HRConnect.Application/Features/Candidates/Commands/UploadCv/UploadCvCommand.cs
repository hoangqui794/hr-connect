using System.Text.Json.Serialization;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UploadCv;

public class UploadCvCommand : IRequest<UploadCvResponse>
{
    [JsonIgnore]
    public Guid? UserId { get; set; }

    public Guid? CandidateId { get; set; }

    [JsonIgnore]
    public Stream FileStream { get; set; } = Stream.Null;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long FileSizeBytes { get; set; }

    public string? Title { get; set; }

    public bool IsPrimary { get; set; } = false;
}

public class UploadCvResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Tải lên CV thành công.";
    public UploadCvResult? Data { get; set; }
}
