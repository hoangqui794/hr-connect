using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Supports PLATFORM_BUILDER, TEMPLATE_FORM and FILE_UPLOAD CV creation methods.
/// </summary>
public partial class CandidateCv
{
    public Guid CvId { get; set; }

    public Guid CandidateId { get; set; }

    public string Title { get; set; } = null!;

    public string CreationMethod { get; set; } = null!;

    public Guid? UploadedByUserId { get; set; }

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

