using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobCommercialTermsDefaults;

public sealed record CommercialTermsDefaultsResponse(bool Success, object? Data);

public sealed record GetJobCommercialTermsDefaultsQuery(Guid JobId) : IRequest<CommercialTermsDefaultsResponse>;

public sealed class GetJobCommercialTermsDefaultsQueryHandler : IRequestHandler<GetJobCommercialTermsDefaultsQuery, CommercialTermsDefaultsResponse>
{
    private readonly IJobRepository _jobs;
    private readonly IAdminBusinessSettings _adminSettings;

    public GetJobCommercialTermsDefaultsQueryHandler(IJobRepository jobs, IAdminBusinessSettings adminSettings)
    {
        _jobs = jobs;
        _adminSettings = adminSettings;
    }

    public async Task<CommercialTermsDefaultsResponse> Handle(GetJobCommercialTermsDefaultsQuery request, CancellationToken ct)
    {
        var job = await _jobs.GetByIdAsync(request.JobId, ct)
            ?? throw new NotFoundException("Không tìm thấy công việc.");

        var serviceTypeCode = job.ServiceType?.Code ?? await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, ct);

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            var adminFeeMultiplier = await _adminSettings.GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier, ct);
            var adminWarrantyDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.HeadhuntWarrantyDays, ct);
            var adminPaymentDueDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, ct);

            var proposed = new
            {
                feeMultiplier = job.ProposedFeeMultiplier,
                warrantyDays = job.ProposedWarrantyDays,
                paymentDueDays = job.ProposedPaymentDueDays,
                note = job.ProposedFeeNote
            };

            var adminDefaults = new
            {
                feeMultiplier = adminFeeMultiplier,
                warrantyDays = adminWarrantyDays,
                paymentDueDays = adminPaymentDueDays
            };

            var prefill = new
            {
                feeMultiplier = job.ProposedFeeMultiplier ?? adminFeeMultiplier,
                warrantyDays = job.ProposedWarrantyDays ?? adminWarrantyDays,
                paymentDueDays = job.ProposedPaymentDueDays ?? adminPaymentDueDays
            };

            var ranges = new
            {
                feeMultiplier = new { min = 0.1m, max = 10m },
                warrantyDays = new { min = 1, max = 365 },
                paymentDueDays = new { min = 1, max = 120 }
            };

            return new CommercialTermsDefaultsResponse(true, new
            {
                serviceTypeCode = ServiceTypeCodes.HeadhuntCod,
                proposed,
                adminDefaults,
                prefill,
                ranges
            });
        }

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            var adminPricePerCv = await _adminSettings.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, ct);
            var adminDepositPercent = await _adminSettings.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, ct);
            var adminReviewDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, ct);
            var adminPaymentDueDays = await _adminSettings.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, ct);

            var proposed = new
            {
                sourcingTarget = job.SourcingTarget,
                pricePerCv = job.ProposedPricePerCv,
                paymentDueDays = job.ProposedPaymentDueDays,
                note = job.ProposedFeeNote
            };

            var adminDefaults = new
            {
                pricePerCv = adminPricePerCv,
                depositPercent = adminDepositPercent,
                reviewDays = adminReviewDays,
                paymentDueDays = adminPaymentDueDays
            };

            var target = job.SourcingTarget ?? 10;
            var price = job.ProposedPricePerCv ?? adminPricePerCv;
            var prefill = new
            {
                sourcingTarget = target,
                pricePerCv = price,
                depositPercent = adminDepositPercent,
                reviewDays = adminReviewDays,
                paymentDueDays = job.ProposedPaymentDueDays ?? adminPaymentDueDays
            };

            var ranges = new
            {
                sourcingTarget = new { min = 1, max = 1000 },
                pricePerCv = new { min = 1000m, max = 100000000m },
                depositPercent = new { min = 0m, max = 100m },
                reviewDays = new { min = 1, max = 30 },
                paymentDueDays = new { min = 1, max = 120 }
            };

            var estimatedTotal = target * price;
            var estimatedDeposit = decimal.Round(estimatedTotal * adminDepositPercent / 100m, 2, MidpointRounding.AwayFromZero);

            return new CommercialTermsDefaultsResponse(true, new
            {
                serviceTypeCode = ServiceTypeCodes.CvSourcing,
                proposed,
                adminDefaults,
                prefill,
                ranges,
                estimatedTotal,
                estimatedDeposit
            });
        }

        return new CommercialTermsDefaultsResponse(true, new
        {
            serviceTypeCode = serviceTypeCode ?? ServiceTypeCodes.CvApplication,
            prefill = (object?)null
        });
    }
}
