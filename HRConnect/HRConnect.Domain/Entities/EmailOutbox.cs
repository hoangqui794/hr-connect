using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class EmailOutbox
{
    public Guid EmailOutboxId { get; set; }

    public Guid? UserId { get; set; }

    public string RecipientEmail { get; set; } = null!;

    public string TemplateCode { get; set; } = null!;

    public string? Subject { get; set; }

    public string Payload { get; set; } = null!;

    public string Status { get; set; } = null!;

    public int RetryCount { get; set; }

    public DateTime? NextRetryAt { get; set; }

    public DateTime? SentAt { get; set; }

    public string? LastError { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AppUser? User { get; set; }
}

