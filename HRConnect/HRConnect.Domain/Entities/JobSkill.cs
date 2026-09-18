using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class JobSkill
{
    public Guid JobId { get; set; }

    public Guid SkillId { get; set; }

    public bool IsMandatory { get; set; }

    public decimal? Weight { get; set; }

    public virtual Job Job { get; set; } = null!;

    public virtual Skill Skill { get; set; } = null!;
}

