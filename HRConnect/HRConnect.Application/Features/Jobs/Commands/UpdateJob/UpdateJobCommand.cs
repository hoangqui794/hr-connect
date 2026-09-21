using System.Text.Json.Serialization;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.UpdateJob;

public sealed class UpdateJobCommand : IRequest<JobActionResponse>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public Guid ServiceTypeId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Location { get; set; }
    public string? EmploymentType { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string CurrencyCode { get; set; } = "VND";
    public int Quantity { get; set; } = 1;
    public string Visibility { get; set; } = "PUBLIC";
    public List<CreateJobRequirementRequest> Requirements { get; set; } = [];
    public List<JobSkillRequest> Skills { get; set; } = [];
}
