using System;
using System.Collections.Generic;
using System.Net;

namespace HRConnect.Domain.Entities;

public partial class RefreshToken
{
    public Guid RefreshTokenId { get; set; }

    public Guid UserId { get; set; }

    public string TokenHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public Guid? ReplacedByTokenId { get; set; }

    public IPAddress? CreatedByIp { get; set; }

    public IPAddress? RevokedByIp { get; set; }

    public string? RevokeReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<RefreshToken> InverseReplacedByToken { get; set; } = new List<RefreshToken>();

    public virtual RefreshToken? ReplacedByToken { get; set; }

    public virtual AppUser User { get; set; } = null!;
}

