using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class CompanyUser
{
    public Guid CompanyUserId { get; set; }

    public Guid CompanyId { get; set; }

    public Guid UserId { get; set; }

    public string? RoleInCompany { get; set; }

    public bool IsPrimaryContact { get; set; }

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual AppUser User { get; set; } = null!;
}

