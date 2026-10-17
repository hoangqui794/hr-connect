using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Offers.Common;

public static class OfferSalaryPolicy
{
    public static string? NormalizeBasis(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var normalized = value.Trim().ToUpperInvariant();
        if (!OfferSalaryBasisCodes.IsValid(normalized))
        {
            throw new BadRequestException(
                "Hình thức lương chỉ chấp nhận GROSS hoặc NET.",
                OfferSalaryErrorCodes.InvalidBasis);
        }

        return normalized;
    }

    public static string? NormalizePeriod(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var normalized = value.Trim().ToUpperInvariant();
        if (!OfferSalaryPeriodCodes.IsValid(normalized))
        {
            throw new BadRequestException(
                "Kỳ lương chỉ chấp nhận MONTHLY hoặc ANNUAL.",
                OfferSalaryErrorCodes.InvalidPeriod);
        }

        return normalized;
    }

    public static decimal? CalculateMonthlyGrossSalary(
        decimal? salary,
        string? salaryBasis,
        string? salaryPeriod)
    {
        if (salary is null or <= 0 ||
            !string.Equals(salaryBasis, OfferSalaryBasisCodes.Gross, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (string.Equals(salaryPeriod, OfferSalaryPeriodCodes.Monthly, StringComparison.OrdinalIgnoreCase))
        {
            return decimal.Round(salary.Value, 2, MidpointRounding.AwayFromZero);
        }

        if (string.Equals(salaryPeriod, OfferSalaryPeriodCodes.Annual, StringComparison.OrdinalIgnoreCase))
        {
            return decimal.Round(salary.Value / 12m, 2, MidpointRounding.AwayFromZero);
        }

        return null;
    }

    public static decimal? EnsureReadyForSending(Offer offer, string? serviceTypeCode)
    {
        if (offer.Salary is null or <= 0 ||
            !OfferSalaryBasisCodes.IsValid(offer.SalaryBasis) ||
            !OfferSalaryPeriodCodes.IsValid(offer.SalaryPeriod))
        {
            throw new BadRequestException(
                "Offer phải có mức lương, hình thức lương và kỳ lương hợp lệ trước khi gửi.",
                OfferSalaryErrorCodes.Incomplete);
        }

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(offer.SalaryBasis, OfferSalaryBasisCodes.Gross, StringComparison.Ordinal))
        {
            throw new BadRequestException(
                "Offer của dịch vụ HEADHUNT_COD bắt buộc sử dụng lương GROSS.",
                OfferSalaryErrorCodes.HeadhuntRequiresGross);
        }

        return CalculateMonthlyGrossSalary(offer.Salary, offer.SalaryBasis, offer.SalaryPeriod);
    }
}
