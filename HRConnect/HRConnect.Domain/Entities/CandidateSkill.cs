using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class CandidateSkill
{
    public Guid CandidateId { get; set; }

    public Guid SkillId { get; set; }

    public string? ProficiencyLevel { get; set; }

    public decimal? YearsOfExperience { get; set; }

    public virtual Candidate Candidate { get; set; } = null!;

    public virtual Skill Skill { get; set; } = null!;
}

