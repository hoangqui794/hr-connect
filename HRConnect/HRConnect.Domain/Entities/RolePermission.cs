using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class RolePermission
{
    public Guid RoleId { get; set; }

    public Guid PermissionId { get; set; }

    public DateTime GrantedAt { get; set; }

    public Guid? GrantedBy { get; set; }

    public string GrantSource { get; set; } = null!;

    public virtual AppUser? GrantedByNavigation { get; set; }

    public virtual Permission Permission { get; set; } = null!;

    public virtual Role Role { get; set; } = null!;
}

