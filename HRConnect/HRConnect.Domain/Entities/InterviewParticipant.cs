using System;

namespace HRConnect.Domain.Entities;

public partial class InterviewParticipant
{
    public Guid InterviewParticipantId { get; set; }

    public Guid InterviewId { get; set; }

    public Guid UserId { get; set; }

    public string Role { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual Interview Interview { get; set; } = null!;

    public virtual AppUser User { get; set; } = null!;
}
