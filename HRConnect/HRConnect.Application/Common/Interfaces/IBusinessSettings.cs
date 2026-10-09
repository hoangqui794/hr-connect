namespace HRConnect.Application.Common.Interfaces;

/// <summary>
/// Trừu tượng hóa các giá trị cấu hình kinh doanh có thể tùy biến theo môi trường.
/// Tránh việc viết cứng các hằng số nghiệp vụ trong mã nguồn (MF-01 Section C, B1, B2, B3).
/// </summary>
public interface IBusinessSettings
{
    /// <summary>
    /// Hệ số phí dịch vụ HEADHUNT_COD mặc định (ví dụ 1.5 = 150% lương tháng offer).
    /// </summary>
    decimal DefaultHeadhuntFeeMultiplier { get; }

    /// <summary>
    /// Số ngày bảo hành HEADHUNT_COD mặc định (mặc định 30 ngày).
    /// </summary>
    int DefaultWarrantyDays { get; }

    /// <summary>
    /// Số ngày đến hạn thanh toán phí dịch vụ HEADHUNT_COD (mặc định 14 ngày kể từ ngày đi làm).
    /// </summary>
    int DefaultPaymentDueDays { get; }

    /// <summary>
    /// Đơn giá mặc định cho mỗi CV đạt chuẩn dịch vụ CV_SOURCING (VNĐ).
    /// </summary>
    decimal DefaultSourcingPricePerCv { get; }

    /// <summary>
    /// Giới hạn số job ACTIVE đồng thời của công ty gói FREE (mặc định 1).
    /// </summary>
    int FreeActiveJobLimit { get; }

    /// <summary>
    /// Chu kỳ mở lại job FREE (mặc định 2 tháng).
    /// </summary>
    int FreeCooldownMonths { get; }

    /// <summary>
    /// Giá gói đăng tin tiêu chuẩn STANDARD cho CV_APPLICATION (mặc định 1.500.000 VNĐ).
    /// </summary>
    decimal StandardPostingPackagePrice { get; }

    /// <summary>
    /// Thời hạn đăng tin của gói STANDARD (mặc định 30 ngày).
    /// </summary>
    int StandardPostingDurationDays { get; }
}
