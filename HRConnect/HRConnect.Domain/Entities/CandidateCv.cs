using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Stores Candidate CVs and submission-scoped CV documents uploaded by Affiliates.
/// </summary>
public partial class CandidateCv
{
    public Guid CvId { get; set; }

    public Guid CandidateId { get; set; }

    public string Title { get; set; } = null!;

    public string CreationMethod { get; set; } = null!;

    public Guid? UploadedByUserId { get; set; }

    /// <summary>
    /// Original Affiliate-uploaded document copied into the Candidate's personal CV library.
    /// Null for regular uploads and for the immutable Affiliate submission document itself.
    /// </summary>
    public Guid? AdoptedFromCvId { get; set; }

    /// <summary>
    /// Controls whether the original Affiliate may use this document to initiate
    /// a new, job-specific consent request. Null for Candidate-owned CVs.
    /// </summary>
    public string? AffiliateReuseStatus { get; set; }

    public DateTime? AffiliateReuseChangedAt { get; set; }

    public Guid? AffiliateReuseChangedByUserId { get; set; }

    public Guid AffiliateReuseConcurrencyToken { get; set; } = Guid.NewGuid();

    public Guid? CvTemplateId { get; set; }

    public string? StructuredContent { get; set; }

    public string? ParsedData { get; set; }

    public string? SourceFileUrl { get; set; }

    public string? RenderedFileUrl { get; set; }

    public string? FileName { get; set; }

    public string? MimeType { get; set; }

    public long? FileSizeBytes { get; set; }

    public bool IsPrimary { get; set; }

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Candidate Candidate { get; set; } = null!;

    public virtual ICollection<CandidateJobMatch> CandidateJobMatches { get; set; } = new List<CandidateJobMatch>();

    public virtual CvTemplate? CvTemplate { get; set; }

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();
}

