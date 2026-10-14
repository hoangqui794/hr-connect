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
    public const string CvSourcingReviewDays = "mf05.cv_sourcing.review_days";
    public const string CvSourcingPricePerCv = "mf05.cv_sourcing.price_per_cv";
    public const string CvSourcingDepositPercent = "mf05.cv_sourcing.deposit_percent";
    public const string CvSourcingPaymentDueDays = "mf05.cv_sourcing.payment_due_days";
    public const string CvApplicationFreeActiveLimit = "mf01.cv_application.free_active_limit";
    public const string CvApplicationFreeCooldownMonths = "mf01.cv_application.free_cooldown_months";

    public static readonly IReadOnlyList<BusinessSettingDefinition> All =
    [
        new(HeadhuntFeeMultiplier, "HEADHUNT_COD", "Hệ số phí dịch vụ",
            "Phí dịch vụ thành công = lương gross tháng trong offer × hệ số này (ví dụ 2 tháng lương gross hoặc ~15-17% lương năm), tính khi ứng viên bắt đầu đi làm.",
            BusinessSettingType.Decimal, 2.0m, 0.1m, 10m, "× lương", "HEADHUNT_COD model, mục 4"),
        new(HeadhuntWarrantyDays, "HEADHUNT_COD", "Số ngày bảo hành",
            "Thời hạn bảo hành thay thế ứng viên (mặc định 30 ngày hoặc theo thỏa thuận hợp đồng riêng).",
            BusinessSettingType.Integer, 30m, 1m, 365m, "ngày", "HEADHUNT_COD model, bảo hành 30 ngày"),
        new(HeadhuntPaymentDueDays, "HEADHUNT_COD", "Hạn thanh toán phí",
            "Số ngày Client phải trả phí, tính từ ngày ứng viên đi làm; quá hạn thì công nợ chuyển OVERDUE.",
            BusinessSettingType.Integer, 20m, 1m, 120m, "ngày", "HEADHUNT_COD model, mục 8"),
        new(CvSourcingAffiliateSharePercent, "CV_SOURCING", "Tỷ lệ quỹ hoa hồng Affiliate",
            "Quỹ hoa hồng = phí dịch vụ CV_SOURCING × tỷ lệ này, chia theo số CV được tính quota.",
            BusinessSettingType.Decimal, 60m, 0m, 100m, "%", "CV_SOURCING model, mục 5 (BR-CVS-09)"),
        new(CvSourcingReviewDays, "CV_SOURCING", "Thời hạn Client xem xét CV",
            "Số ngày Client được chấp nhận hoặc từ chối một CV đã giao; hết hạn mà không phản hồi thì CV được tính là đã chấp nhận.",
            BusinessSettingType.Integer, 7m, 1m, 30m, "ngày", "Quy tắc phí, mục 2"),
        new(CvSourcingPricePerCv, "CV_SOURCING", "Đơn giá mặc định cho mỗi CV đạt yêu cầu",
            "Đơn giá đề xuất/mặc định khi tạo job CV Sourcing (mặc định 600.000 VNĐ/CV).",
            BusinessSettingType.Decimal, 600000m, 1000m, 100000000m, "VNĐ/CV", "Quy tắc phí, mục 2"),
        new(CvSourcingDepositPercent, "CV_SOURCING", "Tỷ lệ đặt cọc CV Sourcing",
            "Tỷ lệ đặt cọc gói CV_SOURCING khi duyệt job (mặc định 50%).",
            BusinessSettingType.Decimal, 50m, 0m, 100m, "%", "Quy tắc phí, mục 2"),
        new(CvSourcingPaymentDueDays, "CV_SOURCING", "Hạn thanh toán phí CV Sourcing",
            "Số ngày Client phải hoàn tất thanh toán phần phí còn lại của gói CV Sourcing.",
            BusinessSettingType.Integer, 20m, 1m, 120m, "ngày", "Quy tắc phí, mục 2"),
        new(CvApplicationFreeActiveLimit, "CV_APPLICATION", "Số tin miễn phí mở đồng thời",
            "Số lượng tin tuyển dụng gói Miễn Phí (FREE) tối đa được phép mở cùng lúc cho một doanh nghiệp.",
            BusinessSettingType.Integer, 1m, 1m, 10m, "tin", "Quy tắc gói đăng tin"),
        new(CvApplicationFreeCooldownMonths, "CV_APPLICATION", "Chu kỳ đăng tin miễn phí",
            "Khoảng thời gian giãn cách tối thiểu giữa hai lần đăng tin miễn phí của một doanh nghiệp.",
            BusinessSettingType.Integer, 2m, 0m, 24m, "tháng", "Quy tắc gói đăng tin"),
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
public interface IAdminBusinessSettings
{
    Task<decimal> GetDecimalAsync(string key, CancellationToken cancellationToken = default);

    Task<int> GetIntAsync(string key, CancellationToken cancellationToken = default);
}
