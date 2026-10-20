using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using System.Globalization;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetJobCommissionEstimate;

/// <summary>
/// N12 (chốt 19/10): Affiliate thấy hoa hồng ước tính theo điều khoản đã chốt trước khi giới thiệu ứng viên.
/// Số thật chỉ có khi ứng viên đi làm (HEADHUNT_COD) hoặc CV được Client chấp nhận (CV_SOURCING).
/// </summary>
public sealed record GetJobCommissionEstimateQuery(Guid JobId, IReadOnlyCollection<string> RoleCodes) : IRequest<JobCommissionEstimateDto>;

public sealed record JobCommissionEstimateDto(
    Guid JobId,
    string ServiceTypeCode,
    bool HasCommission,
    string? RateType,
    decimal? RateValue,
    decimal? FeeMultiplier,
    int? WarrantyDays,
    decimal? EstimatedMin,
    decimal? EstimatedMax,
    decimal? AmountPerCv,
    string CurrencyCode,
    string Explanation);

public sealed class GetJobCommissionEstimateQueryHandler : IRequestHandler<GetJobCommissionEstimateQuery, JobCommissionEstimateDto>
{
    /// <summary>UI-01: số tiền trong câu giải thích theo cách viết tiếng Việt (600.000), không theo culture máy chủ.</summary>
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");

    private readonly IJobRepository _jobs;
    private readonly IFinanceRepository _finance;
    private readonly IAdminBusinessSettings _settings;

    public GetJobCommissionEstimateQueryHandler(IJobRepository jobs, IFinanceRepository finance, IAdminBusinessSettings settings)
    {
        _jobs = jobs;
        _finance = finance;
        _settings = settings;
    }

    public async Task<JobCommissionEstimateDto> Handle(GetJobCommissionEstimateQuery request, CancellationToken cancellationToken)
    {
        var job = await _jobs.GetByIdAsync(request.JobId, cancellationToken);
        if (job == null || !JobAccessPolicy.CanViewDetail(job, isOwner: false, hasInternalAccess: false)
            || !await _jobs.CanAnyRoleViewJobAsync(job.ServiceTypeId, request.RoleCodes, cancellationToken))
        {
            throw new NotFoundException("Không tìm thấy tin tuyển dụng.");
        }

        var code = job.ServiceType?.Code ?? await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, cancellationToken) ?? string.Empty;
        var currency = string.IsNullOrWhiteSpace(job.CurrencyCode) ? "VND" : job.CurrencyCode;

        if (string.Equals(code, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            if (job.SourcingPricePerCv is not decimal price)
                return None(job.JobId, code, currency, "Job chưa chốt giá mỗi CV nên chưa tính được hoa hồng.");
            var share = await _settings.GetDecimalAsync(BusinessSettingKeys.CvSourcingAffiliateSharePercent, cancellationToken);
            var perCv = decimal.Round(price * share / 100m, 0, MidpointRounding.AwayFromZero);
            return new JobCommissionEstimateDto(job.JobId, code, perCv > 0, "PERCENT", share, null, null, null, null, perCv, currency,
                $"Mỗi CV được Client chấp nhận: {share.ToString("0.##", Vi)}% × giá {price.ToString("N0", Vi)} {currency}/CV. Hoa hồng ghi nhận khi CV được chấp nhận.");
        }

        if (!string.Equals(code, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
            return None(job.JobId, code, currency, "Dịch vụ này không có hoa hồng cho Affiliate.");

        var rule = await _finance.GetActiveCommissionRuleAsync(job.ServiceTypeId, DateTime.UtcNow, cancellationToken);
        if (rule?.RateValue is not decimal rate || rate <= 0)
            return None(job.JobId, code, currency, "Chưa có quy tắc hoa hồng đang áp dụng cho dịch vụ này.");

        var multiplier = job.FeeMultiplier ?? await _settings.GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier, cancellationToken);
        var isPercent = string.Equals(rule.RateType, "PERCENT", StringComparison.OrdinalIgnoreCase);
        decimal? Estimate(decimal? salary) => salary is decimal s && s > 0
            ? decimal.Round(isPercent ? s * multiplier * rate / 100m : rate, 0, MidpointRounding.AwayFromZero)
            : null;
        var min = isPercent ? Estimate(job.SalaryMin ?? job.SalaryMax) : rate;
        var max = isPercent ? Estimate(job.SalaryMax ?? job.SalaryMin) : rate;
        var warranty = job.WarrantyDays.HasValue ? $" sau {job.WarrantyDays} ngày bảo hành" : " sau thời gian bảo hành";
        var explanation = isPercent
            ? $"Hoa hồng = {rate.ToString("0.##", Vi)}% × phí dịch vụ; phí = {multiplier.ToString("0.##", Vi)} × lương gross tháng trong offer. Khoảng ước tính theo mức lương đăng tin; nhận{warranty}, khi Client đã thanh toán phí."
            : $"Hoa hồng cố định {rate.ToString("N0", Vi)} {currency} cho mỗi ứng viên đi làm; nhận{warranty}, khi Client đã thanh toán phí.";
        return new JobCommissionEstimateDto(job.JobId, code, true, rule.RateType, rate, multiplier, job.WarrantyDays, min, max, null, currency, explanation);
    }

    private static JobCommissionEstimateDto None(Guid jobId, string code, string currency, string explanation) =>
        new(jobId, code, false, null, null, null, null, null, null, null, currency, explanation);
}
