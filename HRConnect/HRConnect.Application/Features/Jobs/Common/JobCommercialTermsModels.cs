namespace HRConnect.Application.Features.Jobs.Common;

/// <summary>
/// Yêu cầu đề xuất điều khoản thương mại từ Client khi tạo hoặc sửa Job (MF-01 A2).
/// </summary>
public sealed record JobProposedTermsRequest(
    decimal? FeeMultiplier = null,
    int? WarrantyDays = null,
    int? PaymentDueDays = null,
    decimal? PricePerCv = null,
    string? Note = null);

/// <summary>
/// DTO thể hiện các điều khoản do Client đề xuất (MF-01 A5).
/// </summary>
public sealed record JobProposedTermsDto(
    decimal? FeeMultiplier,
    int? WarrantyDays,
    int? PaymentDueDays,
    decimal? PricePerCv,
    string? Note);

/// <summary>
/// Yêu cầu chốt điều khoản thương mại của Internal HR / Admin khi duyệt Job (MF-01 A4.2).
/// </summary>
public sealed record CommercialTermsApprovalRequest(
    decimal? FeeMultiplier = null,
    int? WarrantyDays = null,
    int? PaymentDueDays = null,
    int? SourcingTarget = null,
    decimal? PricePerCv = null,
    decimal? DepositPercent = null,
    int? ReviewDays = null);

/// <summary>
/// DTO thể hiện các điều khoản thương mại chính thức đã chốt sau khi duyệt Job (MF-01 A5).
/// </summary>
public sealed record JobCommercialTermsDto(
    string? ServiceTypeCode,
    decimal? FeeMultiplier,
    int? WarrantyDays,
    int? PaymentDueDays,
    int? SourcingTarget,
    decimal? PricePerCv,
    decimal? DepositPercent,
    int? ReviewDays,
    DateTime? AgreedAt,
    string? AgreedBy,
    string? AgreementReference = null,
    string? AgreementNote = null);

public static class CommercialTermsHelper
{
    public static (decimal? FeeMultiplier, int? WarrantyDays, int? PaymentDueDays, decimal? PricePerCv, string? Note) ResolveProposedTerms(
        string serviceTypeCode,
        JobProposedTermsRequest? requestTerms,
        decimal? legacyFeeMultiplier,
        int? legacyWarrantyDays,
        int? legacyPaymentDueDays,
        decimal? legacyPricePerCv)
    {
        var terms = requestTerms ?? (legacyFeeMultiplier.HasValue || legacyWarrantyDays.HasValue || legacyPaymentDueDays.HasValue || legacyPricePerCv.HasValue
            ? new JobProposedTermsRequest(legacyFeeMultiplier, legacyWarrantyDays, legacyPaymentDueDays, legacyPricePerCv, null)
            : null);

        if (terms == null)
        {
            return (null, null, null, null, null);
        }

        var note = string.IsNullOrWhiteSpace(terms.Note) ? null : terms.Note.Trim();
        if (note != null && note.Length > 1000)
        {
            throw new HRConnect.Application.Common.Exceptions.BadRequestException("Ghi chú đề xuất phí không được vượt quá 1000 ký tự.");
        }

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            if (terms.FeeMultiplier.HasValue && (terms.FeeMultiplier.Value < 0.1m || terms.FeeMultiplier.Value > 10m))
            {
                throw new HRConnect.Application.Common.Exceptions.BadRequestException("Hệ số phí đề xuất (feeMultiplier) phải từ 0.1 đến 10.");
            }

            if (terms.WarrantyDays.HasValue && (terms.WarrantyDays.Value < 1 || terms.WarrantyDays.Value > 365))
            {
                throw new HRConnect.Application.Common.Exceptions.BadRequestException("Số ngày bảo hành đề xuất (warrantyDays) phải từ 1 đến 365 ngày.");
            }

            if (terms.PaymentDueDays.HasValue && (terms.PaymentDueDays.Value < 1 || terms.PaymentDueDays.Value > 120))
            {
                throw new HRConnect.Application.Common.Exceptions.BadRequestException("Hạn thanh toán đề xuất (paymentDueDays) phải từ 1 đến 120 ngày.");
            }

            return (terms.FeeMultiplier, terms.WarrantyDays, terms.PaymentDueDays, null, note);
        }

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            if (terms.PricePerCv.HasValue && (terms.PricePerCv.Value < 1000m || terms.PricePerCv.Value > 100000000m))
            {
                throw new HRConnect.Application.Common.Exceptions.BadRequestException("Đơn giá CV đề xuất (pricePerCv) phải từ 1.000 đến 100.000.000 VNĐ.");
            }

            if (terms.PaymentDueDays.HasValue && (terms.PaymentDueDays.Value < 1 || terms.PaymentDueDays.Value > 120))
            {
                throw new HRConnect.Application.Common.Exceptions.BadRequestException("Hạn thanh toán đề xuất (paymentDueDays) phải từ 1 đến 120 ngày.");
            }

            return (null, null, terms.PaymentDueDays, terms.PricePerCv, note);
        }

        return (null, null, null, null, null);
    }
}

