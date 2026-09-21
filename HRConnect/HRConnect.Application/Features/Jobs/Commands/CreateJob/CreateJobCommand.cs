using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.CreateJob;

public class CreateJobCommand : IRequest<CreateJobResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

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

public class JobSkillRequest
{
    public Guid SkillId { get; set; }

    public bool IsMandatory { get; set; }

    public decimal? Weight { get; set; }
}

public class CreateJobRequirementRequest
{
    public string RequirementType { get; set; } = string.Empty;

    public string? Category { get; set; }

    public string Content { get; set; } = string.Empty;

    public decimal? Weight { get; set; }
}

public class CreateJobResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Tạo bản nháp công việc thành công.";

    public CreateJobData Data { get; set; } = new();
}

public class CreateJobData
{
    public Guid JobId { get; set; }

    public Guid CompanyId { get; set; }

    public Guid ServiceTypeId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Visibility { get; set; } = string.Empty;

    public int RequirementCount { get; set; }

    public int SkillCount { get; set; }

    public DateTime CreatedAt { get; set; }
}
