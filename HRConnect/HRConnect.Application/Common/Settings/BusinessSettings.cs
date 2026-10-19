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
    public const string Mf02ClientOwnershipDays = "mf02.client_ownership_days";
    public const string HeadhuntFeeMultiplier = "mf05.headhunt.fee_multiplier";
    public const string HeadhuntWarrantyDays = "mf05.headhunt.warranty_days";
    public const string HeadhuntPaymentDueDays = "mf05.headhunt.payment_due_days";
    public const string CvSourcingAffiliateSharePercent = "mf05.cv_sourcing.affiliate_share_percent";
    public const string CvSourcingReviewDays = "mf05.cv_sourcing.review_days";
    public const string CvSourcingPricePerCv = "mf05.cv_sourcing.price_per_cv";
    public const string CvSourcingDepositPercent = "mf05.cv_sourcing.deposit_percent";
    public const string CvSourcingPaymentDueDays = "mf05.cv_sourcing.payment_due_days";
    public const string FeeDueReminderDays = "mf05.fee.due_reminder_days";
    public const string ReplacementFillWindowDays = "mf05.replacement.fill_window_days";
    public const string CvApplicationFreeActiveLimit = "mf01.cv_application.free_active_limit";
    public const string CvApplicationFreeCooldownMonths = "mf01.cv_application.free_cooldown_months";
    public const string JobTemplatePageSizeDefault = "mf01.job_template.page_size_default";
    public const string JobTemplatePageSizeMax = "mf01.job_template.page_size_max";
    public const string AffiliateRatingWeightHire = "affiliate.rating.weight_hire";
    public const string AffiliateRatingWeightShortlist = "affiliate.rating.weight_shortlist";
    public const string AffiliateRatingHireRateTarget = "affiliate.rating.hire_rate_target";
    public const string AffiliateRatingMinSubmissions = "affiliate.rating.min_submissions";
    public const string AffiliateRatingExcellentMin = "affiliate.rating.excellent_min";
    public const string AffiliateRatingGoodMin = "affiliate.rating.good_min";
    public const string AffiliateRatingAverageMin = "affiliate.rating.average_min";
    public const string DisputeWindowDays = "dispute.window_days";

    public static readonly IReadOnlyList<BusinessSettingDefinition> All =
    [
        new(Mf02ClientOwnershipDays, "MF02", "Thời hạn doanh nghiệp sở hữu Candidate",
            "Số ngày một doanh nghiệp được ưu tiên xử lý Candidate sau khi đã nhận hồ sơ qua HEADHUNT_COD hoặc CV_SOURCING. Trong thời hạn này Affiliate khác không thể giới thiệu lại Candidate cho cùng doanh nghiệp.",
            BusinessSettingType.Integer, 30m, 1m, 365m, "ngày", "Quy tắc phí, quyền sở hữu Candidate 30 ngày"),
        new(HeadhuntFeeMultiplier, "HEADHUNT_COD", "Hệ số phí dịch vụ",
            "Phí dịch vụ thành công = lương gross tháng trong offer × hệ số này (mặc định 1,5 tháng lương gross; Internal HR chốt lại theo từng job khi duyệt), tính khi ứng viên bắt đầu đi làm.",
            BusinessSettingType.Decimal, 1.5m, 0.1m, 10m, "× lương", "QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md, mục 5 (đã chốt 1,5)"),
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
        new(FeeDueReminderDays, "SERVICE_FEE", "Số ngày nhắc trước hạn thanh toán",
            "Phí dịch vụ còn bằng hoặc ít hơn số ngày này tới hạn thì chuyển sang DUE (Sắp đến hạn) và nhắc Client.",
            BusinessSettingType.Integer, 5m, 1m, 30m, "ngày", "QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md, mục 1.1"),
        new(DisputeWindowDays, "DISPUTE", "Thời hạn khiếu nại trùng ứng viên",
            "Số ngày Affiliate được khiếu nại kể từ lúc lượt nộp bị chặn trùng, hoặc từ lúc ứng viên đi làm (khiếu nại attribution). Bằng thời hạn bảo hành để khiếu nại kịp trước khi hoa hồng được duyệt chi.",
            BusinessSettingType.Integer, 30m, 1m, 180m, "ngày", "main-flows.md, SF-04"),
        new(ReplacementFillWindowDays, "HEADHUNT_COD", "Hạn tìm người thay thế",
            "Số ngày kể từ khi suất thay thế được mở (Client đã trả phí). Quá hạn mà chưa có người đi làm thì suất hết hạn.",
            BusinessSettingType.Integer, 30m, 1m, 180m, "ngày", "main-flows.md, MF-05 suất thay thế"),
        new(JobTemplatePageSizeDefault, "JOB_TEMPLATE", "Số mẫu JD mỗi trang (mặc định)",
            "Số mẫu JD hiển thị mỗi trang khi Client tìm mẫu ở bước 2 của form tạo job.",
            BusinessSettingType.Integer, 8m, 1m, 50m, "mẫu", "main-flows.md, MF-01 thư viện mẫu JD"),
        new(JobTemplatePageSizeMax, "JOB_TEMPLATE", "Số mẫu JD tối đa mỗi trang",
            "Giới hạn trên cho tham số pageSize khi tìm mẫu JD.",
            BusinessSettingType.Integer, 20m, 1m, 100m, "mẫu", "main-flows.md, MF-01 thư viện mẫu JD"),
        new(AffiliateRatingWeightHire, "AFFILIATE_RATING", "Trọng số tỷ lệ tuyển được",
            "Trọng số của tỷ lệ tuyển được trong công thức tính QualityRating của Affiliate (mặc định 0.7).",
            BusinessSettingType.Decimal, 0.7m, 0m, 1m, "trọng số", "main-flows.md, MF-05 đánh giá Affiliate"),
        new(AffiliateRatingWeightShortlist, "AFFILIATE_RATING", "Trọng số tỷ lệ qua sàng lọc",
            "Trọng số của tỷ lệ CV qua sàng lọc trong công thức tính QualityRating của Affiliate (mặc định 0.3).",
            BusinessSettingType.Decimal, 0.3m, 0m, 1m, "trọng số", "main-flows.md, MF-05 đánh giá Affiliate"),
        new(AffiliateRatingHireRateTarget, "AFFILIATE_RATING", "Mục tiêu tỷ lệ tuyển được",
            "Mục tiêu tỷ lệ tuyển được để đạt điểm tối đa phần tuyển dụng (mặc định 0.20 = 20%).",
            BusinessSettingType.Decimal, 0.20m, 0.01m, 1m, "tỷ lệ", "main-flows.md, MF-05 đánh giá Affiliate"),
        new(AffiliateRatingMinSubmissions, "AFFILIATE_RATING", "Số lượt nộp tối thiểu để xếp hạng",
            "Số lượt nộp tối thiểu trong kỳ để được đánh giá xếp hạng và tính QualityRating (dưới ngưỡng này được gắn nhãn NEW).",
            BusinessSettingType.Integer, 5m, 1m, 100m, "lượt", "main-flows.md, MF-05 đánh giá Affiliate"),
        new(AffiliateRatingExcellentMin, "AFFILIATE_RATING", "Ngưỡng đánh giá Xuất sắc (EXCELLENT)",
            "Điểm QualityRating tối thiểu để đạt xếp loại EXCELLENT (mặc định 4.0).",
            BusinessSettingType.Decimal, 4.0m, 0m, 5m, "điểm", "main-flows.md, MF-05 đánh giá Affiliate"),
        new(AffiliateRatingGoodMin, "AFFILIATE_RATING", "Ngưỡng đánh giá Tốt (GOOD)",
            "Điểm QualityRating tối thiểu để đạt xếp loại GOOD (mặc định 3.0).",
            BusinessSettingType.Decimal, 3.0m, 0m, 5m, "điểm", "main-flows.md, MF-05 đánh giá Affiliate"),
        new(AffiliateRatingAverageMin, "AFFILIATE_RATING", "Ngưỡng đánh giá Trung bình (AVERAGE)",
            "Điểm QualityRating tối thiểu để đạt xếp loại AVERAGE (mặc định 2.0). Dưới ngưỡng này là LOW.",
            BusinessSettingType.Decimal, 2.0m, 0m, 5m, "điểm", "main-flows.md, MF-05 đánh giá Affiliate"),
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
