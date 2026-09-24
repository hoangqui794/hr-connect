using System;
using System.Text.Json.Serialization;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateCv;

public class UpdateCandidateCvRequest
{
    public string Title { get; set; } = string.Empty;
}

public class UpdateCandidateCvCommand : IRequest<UpdateCandidateCvResponse>
{
    [JsonIgnore]
    public Guid CvId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }

    public string Title { get; set; } = string.Empty;
}

public class UpdateCandidateCvResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật thông tin CV thành công.";
    public CandidateCvItemResponse? Data { get; set; }
}
