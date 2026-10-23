using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Thỏa thuận dịch vụ tuyển dụng (MF-01) giữa Client và HR Connect cho các dịch vụ đàm phán (CV_SOURCING, HEADHUNT_COD).
/// Hỗ trợ quản lý phiên bản, chữ ký điện tử qua email OTP, và lưu trữ tài liệu PDF bất biến.
/// </summary>
public partial class ServiceAgreement
{
    public Guid ServiceAgreementId { get; set; }

    public Guid JobId { get; set; }

    public Guid CompanyId { get; set; }

    /// <summary>Số phiên bản của thỏa thuận (1, 2, 3...).</summary>
    public int Version { get; set; }

    /// <summary>Mã loại dịch vụ: CV_APPLICATION, CV_SOURCING, HEADHUNT_COD.</summary>
    public string ServiceTypeCode { get; set; } = null!;

    /// <summary>Trạng thái thỏa thuận: DRAFT, SENT_TO_CLIENT, CHANGE_REQUESTED, ACCEPTED, AWAITING_SIGNATURE, SIGNED, VOID, LEGACY_CONFIRMED.</summary>
    public string Status { get; set; } = null!;

    public Guid ConcurrencyToken { get; set; }

    /// <summary>Chỉ định thỏa thuận này là phiên bản hiện hành duy nhất đang có hiệu lực của Job.</summary>
    public bool IsCurrent { get; set; }

    // Commercial terms
    public decimal? FeeMultiplier { get; set; }

    public int? WarrantyDays { get; set; }

    public int? PaymentDueDays { get; set; }

    public decimal? PricePerQualifiedCv { get; set; }

    public int? SourcingTarget { get; set; }

    public int? ReviewDays { get; set; }

    public string? AgreementNote { get; set; }

    public string? ChangeRequestReason { get; set; }

    // Legal & Signer Snapshots
    public string CompanyNameSnapshot { get; set; } = null!;

    public string? CompanyTaxCodeSnapshot { get; set; }

    public string? CompanyAddressSnapshot { get; set; }

    public string? HrConnectLegalEntitySnapshot { get; set; }

    public Guid? SignerUserId { get; set; }

    public string? SignerNameSnapshot { get; set; }

    public string? SignerEmailSnapshot { get; set; }

    public string? SignerRoleSnapshot { get; set; }

    public string? ConsentTextVersion { get; set; }

    public DateTime? ConsentAcceptedAt { get; set; }

    // Document & Verification
    public string? UnsignedDocumentStorageKey { get; set; }

    public string? SignedDocumentStorageKey { get; set; }

    public string? DocumentSha256Hash { get; set; }

    /// <summary>Mã xác thực duy nhất dùng để tra cứu công khai tính toàn vẹn của thỏa thuận.</summary>
    public string VerificationCode { get; set; } = null!;

    public string? SignerIpHash { get; set; }

    public string? SignerUserAgentSummary { get; set; }

    // Timestamps & Actors
    public Guid CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? SentToClientAt { get; set; }

    public DateTime? RespondedAt { get; set; }

    public DateTime? SignedAt { get; set; }

    public DateTime? VoidedAt { get; set; }

    public Guid? VoidedByUserId { get; set; }

    public string? VoidReason { get; set; }

    // Navigations
    public virtual Job Job { get; set; } = null!;

    public virtual Company Company { get; set; } = null!;

    public virtual AppUser CreatedByUser { get; set; } = null!;

    public virtual AppUser? SignerUser { get; set; }

    public virtual AppUser? VoidedByUser { get; set; }

    public virtual ICollection<ServiceAgreementSignatureChallenge> SignatureChallenges { get; set; } = new List<ServiceAgreementSignatureChallenge>();
}
