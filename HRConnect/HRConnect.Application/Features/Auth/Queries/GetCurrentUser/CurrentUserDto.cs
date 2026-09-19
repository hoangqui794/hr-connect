using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Auth.Queries.GetCurrentUser;

public class CurrentUserDto
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string? DisplayName { get; set; }

    public string? Phone { get; set; }

    public string? AvatarUrl { get; set; }

    public string Status { get; set; } = string.Empty;

    public bool EmailVerified { get; set; }

    public List<string> Roles { get; set; } = new();

    public List<string> Permissions { get; set; } = new();
}
