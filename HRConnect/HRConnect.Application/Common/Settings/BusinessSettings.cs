using System.Globalization;

namespace HRConnect.Application.Common.Settings;

public enum BusinessSettingType
{
    Integer,
    Decimal,
}

/// <summary>A configurable business number: its default comes from the business-model documents.</summary>
public sealed record BusinessSettingDefinition(
    string Key,
    string Group,
    string Label,
    string Description,
    BusinessSettingType Type,
    decimal DefaultValue,
    decimal Min,
    decimal Max,
    string Unit,
    string Source);

/// <summary>
/// Every configurable MF-03/MF-05 number. Defaults follow HRConnect/docs; Platform Admin can override
/// them at runtime (stored in system_setting). Adding a number = adding one entry here.
/// </summary>
public static class BusinessSettingKeys
{
    public const string HeadhuntFeeMultiplier = "mf05.headhunt.fee_multiplier";
    public const string HeadhuntWarrantyDays = "mf05.headhunt.warranty_days";
    public const string HeadhuntPaymentDueDays = "mf05.headhunt.payment_due_days";
    public const string CvSourcingAffiliateSharePercent = "mf05.cv_sourcing.affiliate_share_percent";

    public static readonly IReadOnlyList<BusinessSettingDefinition> All =
    [
        new(HeadhuntFeeMultiplier, "HEADHUNT_COD", "Hệ số phí dịch vụ",
            "Phí dịch vụ = lương gross tháng trong offer × hệ số này, tính cho từng người đi làm.",
            BusinessSettingType.Decimal, 1.5m, 0.1m, 10m, "× lương", "HEADHUNT_COD model, mục 4"),
        new(HeadhuntWarrantyDays, "HEADHUNT_COD", "Số ngày bảo hành",
            "Ứng viên đi làm đủ số ngày này thì bảo hành qua và Affiliate nhận 100% hoa hồng.",
            BusinessSettingType.Integer, 30m, 1m, 365m, "ngày", "Quyết định nhóm 2026-10-09"),
        new(HeadhuntPaymentDueDays, "HEADHUNT_COD", "Hạn thanh toán phí",
            "Số ngày Client phải trả phí, tính từ ngày ứng viên đi làm; quá hạn thì công nợ chuyển OVERDUE.",
            BusinessSettingType.Integer, 20m, 1m, 120m, "ngày", "HEADHUNT_COD model, mục 8"),
        new(CvSourcingAffiliateSharePercent, "CV_SOURCING", "Tỷ lệ quỹ hoa hồng Affiliate",
            "Quỹ hoa hồng = phí dịch vụ CV_SOURCING × tỷ lệ này, chia theo số CV được tính quota.",
            BusinessSettingType.Decimal, 60m, 0m, 100m, "%", "CV_SOURCING model, mục 5 (BR-CVS-09)"),
    ];

    public static BusinessSettingDefinition Get(string key) =>
        All.FirstOrDefault(d => d.Key == key) ?? throw new KeyNotFoundException($"Unknown business setting '{key}'.");

    public static string Format(decimal value) => value.ToString(CultureInfo.InvariantCulture);

    public static bool TryParse(BusinessSettingDefinition definition, string? raw, out decimal value)
    {
        value = 0;
        if (!decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
        {
            return false;
        }

        if (definition.Type == BusinessSettingType.Integer && parsed != decimal.Truncate(parsed))
        {
            return false;
        }

        if (parsed < definition.Min || parsed > definition.Max)
        {
            return false;
        }

        value = parsed;
        return true;
    }
}

/// <summary>Reads configurable business numbers: the Admin override if present, otherwise the documented default.</summary>
public interface IBusinessSettings
{
    Task<decimal> GetDecimalAsync(string key, CancellationToken cancellationToken = default);

    Task<int> GetIntAsync(string key, CancellationToken cancellationToken = default);
}
