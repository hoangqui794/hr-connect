namespace HRConnect.Domain.Entities;

/// <summary>
/// MF-01: a shared JD template (job description, requirements, skills) that a Client can start a job
/// from. Internal HR and Admin manage the library. A job created from a template is an independent
/// copy: editing or hiding the template never changes existing jobs.
/// </summary>
public partial class JobTemplate
{
    public Guid TemplateId { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Industry { get; set; } = null!;

    public string? Level { get; set; }

    public string? Keywords { get; set; }

    public string? Summary { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string? Benefits { get; set; }

    public string? EmploymentType { get; set; }

    public int? MinExperienceYears { get; set; }

    public int? MaxExperienceYears { get; set; }

    /// <summary>Lower-cased, accent-free name + title + keywords + industry, rebuilt on every save.</summary>
    public string SearchText { get; set; } = null!;

    public bool IsActive { get; set; } = true;

    public int UsageCount { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? CreatedBy { get; set; }

    public Guid? UpdatedBy { get; set; }

    public virtual ICollection<JobTemplateRequirement> Requirements { get; set; } = new List<JobTemplateRequirement>();
}
