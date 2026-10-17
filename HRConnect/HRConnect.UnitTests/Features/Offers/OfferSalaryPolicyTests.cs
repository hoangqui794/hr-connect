using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class OfferSalaryPolicyTests
{
    [Theory]
    [InlineData(" gross ", OfferSalaryBasisCodes.Gross)]
    [InlineData("net", OfferSalaryBasisCodes.Net)]
    public void NormalizeBasis_accepts_supported_values_case_insensitively(string input, string expected)
    {
        OfferSalaryPolicy.NormalizeBasis(input).Should().Be(expected);
    }

    [Theory]
    [InlineData(" monthly ", OfferSalaryPeriodCodes.Monthly)]
    [InlineData("annual", OfferSalaryPeriodCodes.Annual)]
    public void NormalizePeriod_accepts_supported_values_case_insensitively(string input, string expected)
    {
        OfferSalaryPolicy.NormalizePeriod(input).Should().Be(expected);
    }

    [Fact]
    public void InvalidSalaryCodes_return_stable_error_codes()
    {
        var basis = () => OfferSalaryPolicy.NormalizeBasis("TAKE_HOME");
        var period = () => OfferSalaryPolicy.NormalizePeriod("WEEKLY");

        basis.Should().Throw<BadRequestException>()
            .Which.ErrorCode.Should().Be(OfferSalaryErrorCodes.InvalidBasis);
        period.Should().Throw<BadRequestException>()
            .Which.ErrorCode.Should().Be(OfferSalaryErrorCodes.InvalidPeriod);
    }

    [Theory]
    [InlineData(24_000_000, OfferSalaryPeriodCodes.Monthly, 24_000_000)]
    [InlineData(240_000_000, OfferSalaryPeriodCodes.Annual, 20_000_000)]
    public void CalculateMonthlyGrossSalary_normalizes_supported_periods(
        decimal salary,
        string period,
        decimal expected)
    {
        OfferSalaryPolicy.CalculateMonthlyGrossSalary(salary, OfferSalaryBasisCodes.Gross, period)
            .Should().Be(expected);
    }

    [Fact]
    public void CalculateMonthlyGrossSalary_returns_null_for_net_salary()
    {
        OfferSalaryPolicy.CalculateMonthlyGrossSalary(
                20_000_000m,
                OfferSalaryBasisCodes.Net,
                OfferSalaryPeriodCodes.Monthly)
            .Should().BeNull();
    }

    [Fact]
    public void EnsureReadyForSending_rejects_net_salary_for_headhunt()
    {
        var offer = new Offer
        {
            Salary = 20_000_000m,
            SalaryBasis = OfferSalaryBasisCodes.Net,
            SalaryPeriod = OfferSalaryPeriodCodes.Monthly
        };

        var act = () => OfferSalaryPolicy.EnsureReadyForSending(offer, ServiceTypeCodes.HeadhuntCod);

        act.Should().Throw<BadRequestException>()
            .Which.ErrorCode.Should().Be(OfferSalaryErrorCodes.HeadhuntRequiresGross);
    }
}
