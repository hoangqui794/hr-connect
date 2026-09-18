using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Skill
{
    public Guid SkillId { get; set; }

    public string SkillName { get; set; } = null!;

    public string NormalizedName { get; set; } = null!;

    public string? Category { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<CandidateSkill> CandidateSkills { get; set; } = new List<CandidateSkill>();

    public virtual ICollection<JobSkill> JobSkills { get; set; } = new List<JobSkill>();
}

