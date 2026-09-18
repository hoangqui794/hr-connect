using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class CvTemplate
{
    public Guid CvTemplateId { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string? PreviewUrl { get; set; }

    public string TemplateConfig { get; set; } = null!;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<CandidateCv> CandidateCvs { get; set; } = new List<CandidateCv>();
}

