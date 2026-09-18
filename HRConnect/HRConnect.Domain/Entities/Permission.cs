using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Permission
{
    public Guid PermissionId { get; set; }

    public string Code { get; set; } = null!;

    public string Resource { get; set; } = null!;

    public string Action { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

