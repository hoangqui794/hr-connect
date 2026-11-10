using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationCounts;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetRecruitmentApplicationCountsQueryHandlerTests
{
    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<ICompanyUserRepository> _companyUsers = new();

    private GetRecruitmentApplicationCountsQueryHandler Handler() => new(_applications.Object, _companyUsers.Object);

    [Fact]
    public async Task Client_counts_are_scoped_to_its_company_and_summed()
    {
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        _companyUsers.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        _applications.Setup(r => r.CountRecruitmentApplicationsAsync(companyId, null, null, null, "CV_APPLICATION", RecruitmentCountGroup.Status, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<string, int> { ["SUBMITTED"] = 3, ["REJECTED"] = 2 });

        var result = await Handler().Handle(
            new GetRecruitmentApplicationCountsQuery(userId, true, false, "STATUS", ServiceTypeCode: "CV_APPLICATION"), CancellationToken.None);

        result.Data.GroupBy.Should().Be("status");
        result.Data.Total.Should().Be(5);
        result.Data.Counts.Should().ContainKey("SUBMITTED").WhoseValue.Should().Be(3);
    }

    [Fact]
    public async Task Internal_hr_counts_are_not_scoped_to_a_company()
    {
        _applications.Setup(r => r.CountRecruitmentApplicationsAsync(null, null, null, null, null, RecruitmentCountGroup.Job, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<string, int>());

        var result = await Handler().Handle(new GetRecruitmentApplicationCountsQuery(Guid.NewGuid(), false, true, "job"), CancellationToken.None);

        result.Data.Total.Should().Be(0);
        _companyUsers.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Unknown_group_is_rejected()
    {
        var act = () => Handler().Handle(new GetRecruitmentApplicationCountsQuery(Guid.NewGuid(), false, true, "candidate"), CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Client_without_company_is_forbidden()
    {
        var userId = Guid.NewGuid();
        _companyUsers.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);

        var act = () => Handler().Handle(new GetRecruitmentApplicationCountsQuery(userId, true, false, "job"), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }
}
