using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services;

/// <summary>
/// Cung cấp các tham số kinh doanh linh hoạt dựa trên cấu hình hệ thống và fallback defaults.
/// Đồng thời đồng bộ tương thích với Mf05Settings nếu có.
/// </summary>
public sealed class BusinessSettings : IBusinessSettings
{
    private readonly BusinessSettingsOptions _options;

    public BusinessSettings(
        IOptions<BusinessSettingsOptions> options,
        IOptions<Mf05Settings>? mf05Options = null)
    {
        _options = options.Value ?? new BusinessSettingsOptions();

        // Đồng bộ tương thích ngược nếu Mf05Settings đã được cấu hình trong hệ thống
        if (mf05Options?.Value is { } mf05)
        {
            if (mf05.WarrantyDays > 0)
            {
                _options.DefaultWarrantyDays = mf05.WarrantyDays;
            }

            if (mf05.HeadhuntFeeMultiplier > 0)
            {
                _options.DefaultHeadhuntFeeMultiplier = mf05.HeadhuntFeeMultiplier;
            }

            if (mf05.PaymentDueDays > 0)
            {
                _options.DefaultPaymentDueDays = mf05.PaymentDueDays;
            }
        }
    }

    public decimal DefaultHeadhuntFeeMultiplier => _options.DefaultHeadhuntFeeMultiplier;

    public int DefaultWarrantyDays => _options.DefaultWarrantyDays;

    public int DefaultPaymentDueDays => _options.DefaultPaymentDueDays;

    public decimal DefaultSourcingPricePerCv => _options.DefaultSourcingPricePerCv;

    public int FreeActiveJobLimit => _options.FreeActiveJobLimit;

    public int FreeCooldownMonths => _options.FreeCooldownMonths;

    public decimal StandardPostingPackagePrice => _options.StandardPostingPackagePrice;

    public int StandardPostingDurationDays => _options.StandardPostingDurationDays;
}
