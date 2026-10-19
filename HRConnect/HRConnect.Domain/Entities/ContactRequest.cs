using System;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Public "contact us" request (BE-04 A): a guest asks HR Connect about a service.
/// Personal data is stored only with explicit consent (Decree 13/2023/ND-CP).
/// </summary>
public class ContactRequest
{
    public Guid ContactRequestId { get; set; }

    public string FullName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string? Phone { get; set; }

    public string? CompanyName { get; set; }

    /// <summary>HEADHUNT_COD, CV_SOURCING, CV_APPLICATION or OTHER.</summary>
    public string ServiceInterest { get; set; } = null!;

    public string Message { get; set; } = null!;

    public bool ConsentAccepted { get; set; }

    /// <summary>NEW, CONTACTED or CLOSED.</summary>
    public string Status { get; set; } = null!;

    public Guid? HandledBy { get; set; }

    public string? Note { get; set; }

    /// <summary>SHA-256 of the sender IP, only to enforce the per-hour limit (the raw IP is not stored).</summary>
    public string SourceIpHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
