namespace HRConnect.Domain.Entities;

/// <summary>One requirement of a <see cref="JobTemplate"/>; same shape as a job requirement. Category SKILL marks a skill tag.</summary>
public partial class JobTemplateRequirement
{
    public Guid TemplateRequirementId { get; set; }

    public Guid TemplateId { get; set; }

    public string RequirementType { get; set; } = null!;

    public string? Category { get; set; }

    public string Content { get; set; } = null!;

    public int DisplayOrder { get; set; }

    public virtual JobTemplate Template { get; set; } = null!;
}
