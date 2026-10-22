using System;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public class ServiceAgreementDto
{
    public Guid ServiceAgreementId { get; set; }
    public Guid JobId { get; set; }
    public Guid CompanyId { get; set; }
    public int Version { get; set; }
    public string ServiceTypeCode { get; set; } = null!;
    public string Status { get; set; } = null!;
    public Guid ConcurrencyToken { get; set; }
    public bool IsCurrent { get; set; }

    public decimal? FeeMultiplier { get; set; }
    public int? WarrantyDays { get; set; }
    public int? PaymentDueDays { get; set; }
    public decimal? PricePerQualifiedCv { get; set; }
    public int? SourcingTarget { get; set; }
    public int? ReviewDays { get; set; }
    public string? AgreementNote { get; set; }
    public string? ChangeRequestReason { get; set; }

    public string CompanyName { get; set; } = null!;
    public string? CompanyTaxCode { get; set; }
    public string? CompanyAddress { get; set; }

    public Guid? SignerUserId { get; set; }
    public string? SignerName { get; set; }
    public string? SignerEmail { get; set; }
    public string? SignerRole { get; set; }
    public string? ConsentTextVersion { get; set; }
    public DateTime? ConsentAcceptedAt { get; set; }

    public string VerificationCode { get; set; } = null!;
    public bool HasUnsignedDocument { get; set; }
    public bool HasSignedDocument { get; set; }
    public string? DocumentSha256Hash { get; set; }

    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentToClientAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public DateTime? SignedAt { get; set; }
    public DateTime? VoidedAt { get; set; }
    public string? VoidReason { get; set; }

    public static ServiceAgreementDto FromEntity(ServiceAgreement a) => new()
    {
        ServiceAgreementId = a.ServiceAgreementId,
        JobId = a.JobId,
        CompanyId = a.CompanyId,
        Version = a.Version,
        ServiceTypeCode = a.ServiceTypeCode,
        Status = a.Status,
        ConcurrencyToken = a.ConcurrencyToken,
        IsCurrent = a.IsCurrent,
        FeeMultiplier = a.FeeMultiplier,
        WarrantyDays = a.WarrantyDays,
        PaymentDueDays = a.PaymentDueDays,
        PricePerQualifiedCv = a.PricePerQualifiedCv,
        SourcingTarget = a.SourcingTarget,
        ReviewDays = a.ReviewDays,
        AgreementNote = a.AgreementNote,
        ChangeRequestReason = a.ChangeRequestReason,
        CompanyName = a.CompanyNameSnapshot,
        CompanyTaxCode = a.CompanyTaxCodeSnapshot,
        CompanyAddress = a.CompanyAddressSnapshot,
        SignerUserId = a.SignerUserId,
        SignerName = a.SignerNameSnapshot,
        SignerEmail = a.SignerEmailSnapshot,
        SignerRole = a.SignerRoleSnapshot,
        ConsentTextVersion = a.ConsentTextVersion,
        ConsentAcceptedAt = a.ConsentAcceptedAt,
        VerificationCode = a.VerificationCode,
        HasUnsignedDocument = !string.IsNullOrWhiteSpace(a.UnsignedDocumentStorageKey),
        HasSignedDocument = !string.IsNullOrWhiteSpace(a.SignedDocumentStorageKey),
        DocumentSha256Hash = a.DocumentSha256Hash,
        CreatedByUserId = a.CreatedByUserId,
        CreatedAt = a.CreatedAt,
        SentToClientAt = a.SentToClientAt,
        RespondedAt = a.RespondedAt,
        SignedAt = a.SignedAt,
        VoidedAt = a.VoidedAt,
        VoidReason = a.VoidReason
    };
}

public class PublicServiceAgreementVerificationDto
{
    public string VerificationCode { get; set; } = null!;
    public string JobTitle { get; set; } = null!;
    public string CompanyName { get; set; } = null!;
    public string ServiceTypeCode { get; set; } = null!;
    public int Version { get; set; }
    public string Status { get; set; } = null!;
    public DateTime? SignedAt { get; set; }
    public string? DocumentSha256Hash { get; set; }
    public bool IsValid { get; set; }
}
