using System;
using System.Collections.Generic;
using System.Net;

namespace HRConnect.Domain.Entities;

public partial class UserToken
{
    public Guid TokenId { get; set; }

    public Guid UserId { get; set; }

    public string TokenType { get; set; } = null!;

    public string TokenHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public int AttemptCount { get; set; }

    public IPAddress? CreatedByIp { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AppUser User { get; set; } = null!;
}

