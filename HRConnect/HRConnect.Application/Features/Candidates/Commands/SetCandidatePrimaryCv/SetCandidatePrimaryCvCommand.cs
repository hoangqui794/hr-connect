using System;
using System.Text.Json.Serialization;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.SetCandidatePrimaryCv;

public class SetCandidatePrimaryCvCommand : IRequest<SetCandidatePrimaryCvResponse>
{
    [JsonIgnore]
    public Guid CvId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }
}

public class SetCandidatePrimaryCvResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Đặt CV chính thành công.";
    public CandidateCvItemResponse? Data { get; set; }
}
