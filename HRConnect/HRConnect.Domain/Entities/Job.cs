using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Job
{
    public Guid JobId { get; set; }

    public Guid CompanyId { get; set; }

    public Guid ServiceTypeId { get; set; }

    public Guid CreatedBy { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string? Location { get; set; }

    public string? EmploymentType { get; set; }

    public decimal? SalaryMin { get; set; }

    public decimal? SalaryMax { get; set; }

    public string CurrencyCode { get; set; } = null!;

    public int Quantity { get; set; }

    /// <summary>
    /// Allowed Job states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.
    /// </summary>
    public string Status { get; set; } = null!;

    public DateTime? PostedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// D07-ready job visibility. Exact actor permissions remain a business-rule/authorization concern.
    /// </summary>
    public string Visibility { get; set; } = null!;

    public string? StatusReason { get; set; }

    public virtual ICollection<Application> Applications { get; set; } = new List<Application>();

    public virtual ICollection<CandidateJobMatch> CandidateJobMatches { get; set; } = new List<CandidateJobMatch>();

    public virtual Company Company { get; set; } = null!;

    public virtual AppUser CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<JobRequirement> JobRequirements { get; set; } = new List<JobRequirement>();

    public virtual ICollection<JobSkill> JobSkills { get; set; } = new List<JobSkill>();

    public virtual ICollection<JobStatusHistory> JobStatusHistories { get; set; } = new List<JobStatusHistory>();

    public virtual ServiceType ServiceType { get; set; } = null!;

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();
}

