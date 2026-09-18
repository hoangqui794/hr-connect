using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class AdminProfile
{
    public Guid AdminProfileId { get; set; }

    public Guid UserId { get; set; }

    public string? EmployeeCode { get; set; }

    public string? JobTitle { get; set; }

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual AppUser User { get; set; } = null!;
}

