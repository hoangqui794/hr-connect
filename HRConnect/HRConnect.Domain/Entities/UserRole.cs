using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Role ownership/lifecycle. Candidate and Affiliate may coexist on the same app_user. Other multi-role combinations remain subject to business policy.
/// </summary>
public partial class UserRole
{
    public Guid UserId { get; set; }

    public Guid RoleId { get; set; }

    public Guid? AssignedBy { get; set; }

    public string AssignmentSource { get; set; } = null!;

    public DateTime AssignedAt { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? RevokedAt { get; set; }

    public Guid? RevokedBy { get; set; }

    public string? RevokeReason { get; set; }

    public virtual AppUser? AssignedByNavigation { get; set; }

    public virtual AppUser? RevokedByNavigation { get; set; }

    public virtual Role Role { get; set; } = null!;

    public virtual AppUser User { get; set; } = null!;
}

