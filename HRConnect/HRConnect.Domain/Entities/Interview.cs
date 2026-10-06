using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Interview
{
    public Guid InterviewId { get; set; }

    public Guid ApplicationId { get; set; }

    public int InterviewRound { get; set; }

    public string? InterviewType { get; set; }

    public DateTime? ScheduledAt { get; set; }

    public int? DurationMinutes { get; set; }

    public string? Location { get; set; }

    public string? MeetingLink { get; set; }

    public string Status { get; set; } = null!;

    public string? Result { get; set; }

    public string? Feedback { get; set; }

    public Guid? CreatedBy { get; set; }

    public Guid? RecordedBy { get; set; }

    public DateTime? RecordedAt { get; set; }

    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Application Application { get; set; } = null!;

    public virtual AppUser? CreatedByNavigation { get; set; }

    public virtual AppUser? RecordedByNavigation { get; set; }

    public virtual ICollection<InterviewStatusHistory> InterviewStatusHistories { get; set; } = new List<InterviewStatusHistory>();

    public virtual ICollection<InterviewParticipant> InterviewParticipants { get; set; } = new List<InterviewParticipant>();
}

