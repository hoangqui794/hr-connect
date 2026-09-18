using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// In-app notification store. JOB_FIT notifications may reference a Job through related_entity_type/related_entity_id.
/// </summary>
public partial class Notification
{
    public Guid NotificationId { get; set; }

    public Guid UserId { get; set; }

    /// <summary>
    /// JOB_FIT is optional D16; other values cover baseline account/company/job/submission/recruitment/commission events.
    /// </summary>
    public string NotificationType { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public string? RelatedEntityType { get; set; }

    public Guid? RelatedEntityId { get; set; }

    public string Metadata { get; set; } = null!;

    public bool IsRead { get; set; }

    public DateTime? ReadAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AppUser User { get; set; } = null!;
}

