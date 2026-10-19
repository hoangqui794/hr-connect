using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Affiliates.Queries.GetJobCommissionEstimate;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

/// <summary>N12: estimated commission on the affiliate job detail.</summary>
public class JobCommissionEstimateTests
{
    private readonly Mock<IJobRepository> _jobs = new();
    private readonly Mock<IFinanceRepository> _finance = new();
    private readonly Mock<IAdminBusinessSettings> _settings = new();

    private GetJobCommissionEstimateQueryHandler Handler() => new(_jobs.Object, _finance.Object, _settings.Object);

    private Job SetupJob(string serviceCode, Action<Job>? configure = null, bool canView = true)
    {
        var job = new Job
        {
            JobId = Guid.NewGuid(), ServiceTypeId = Guid.NewGuid(), Title = "Dev", CurrencyCode = "VND", Status = "ACTIVE",
            ServiceType = new ServiceType { Code = serviceCode, Name = serviceCode },
        };
        configure?.Invoke(job);
        _jobs.Setup(r => r.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobs.Setup(r => r.CanAnyRoleViewJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(canView);
        return job;
    }

    [Fact]
    public async Task Headhunt_ShouldEstimateFromRuleMultiplierAndPostedSalary()
    {
        var job = SetupJob("HEADHUNT_COD", j => { j.SalaryMin = 20_000_000m; j.SalaryMax = 30_000_000m; j.FeeMultiplier = 1.5m; j.WarrantyDays = 30; });
        _finance.Setup(f => f.GetActiveCommissionRuleAsync(job.ServiceTypeId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CommissionRule { RateType = "PERCENT", RateValue = 20m });

        var result = await Handler().Handle(new GetJobCommissionEstimateQuery(job.JobId, ["AFFILIATE_RECRUITER"]), default);

        result.HasCommission.Should().BeTrue();
        result.EstimatedMin.Should().Be(6_000_000m);   // 20% × 1.5 × 20M
        result.EstimatedMax.Should().Be(9_000_000m);
        result.WarrantyDays.Should().Be(30);
    }

    [Fact]
    public async Task Sourcing_ShouldReturnAmountPerAcceptedCv()
    {
        var job = SetupJob("CV_SOURCING", j => j.SourcingPricePerCv = 600_000m);
        _settings.Setup(s => s.GetDecimalAsync(BusinessSettingKeys.CvSourcingAffiliateSharePercent, It.IsAny<CancellationToken>())).ReturnsAsync(30m);

        var result = await Handler().Handle(new GetJobCommissionEstimateQuery(job.JobId, ["AFFILIATE_RECRUITER"]), default);

        result.AmountPerCv.Should().Be(180_000m);
    }

    [Fact]
    public async Task JobTheRoleCannotView_ShouldBeNotFound()
    {
        var job = SetupJob("HEADHUNT_COD", canView: false);

        var act = () => Handler().Handle(new GetJobCommissionEstimateQuery(job.JobId, ["AFFILIATE_RECRUITER"]), default);

        await act.Should().ThrowAsync<NotFoundException>();
    }
}
