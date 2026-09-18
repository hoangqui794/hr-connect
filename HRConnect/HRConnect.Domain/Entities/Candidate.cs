using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Candidate
{
    public Guid CandidateId { get; set; }

    public Guid? UserId { get; set; }

    public string FullName { get; set; } = null!;

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? NormalizedEmail { get; set; }

    public string? NormalizedPhone { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public string? Gender { get; set; }

    public string? CurrentAddress { get; set; }

    public string? HighestEducation { get; set; }

    public decimal? YearsOfExperience { get; set; }

    public string? Summary { get; set; }

    public string ProfileVisibility { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// Canonical ACTIVE Candidate that owns the merged identity. Merge cycles and non-ACTIVE targets are rejected.
    /// </summary>
    public Guid? MergedIntoCandidateId { get; set; }

    public virtual ICollection<Application> Applications { get; set; } = new List<Application>();

    public virtual CandidateCv? CandidateCv { get; set; }

    public virtual ICollection<CandidateJobMatch> CandidateJobMatches { get; set; } = new List<CandidateJobMatch>();

    public virtual ICollection<CandidateSkill> CandidateSkills { get; set; } = new List<CandidateSkill>();

    public virtual ICollection<Candidate> InverseMergedIntoCandidate { get; set; } = new List<Candidate>();

    public virtual Candidate? MergedIntoCandidate { get; set; }

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();

    public virtual AppUser? User { get; set; }
}

