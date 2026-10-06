using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CommissionMilestones.Queries.GetCommissionMilestones;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CommissionMilestones;

public class GetCommissionMilestonesQueryHandlerTests
{
    private readonly Mock<ICommissionMilestoneRepository> _milestones = new();
    private readonly GetCommissionMilestonesQueryHandler _handler;

    public GetCommissionMilestonesQueryHandlerTests() => _handler = new(_milestones.Object);

    [Fact]
    public async Task Handle_ReturnsProjectedMilestonesForTheRequestedActiveFilter()
    {
        var createdAt = DateTime.UtcNow.AddDays(-2);
        var updatedAt = DateTime.UtcNow;
        _milestones.Setup(repository => repository.GetListAsync(true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CommissionMilestone>
            {
                new()
                {
                    MilestoneCode = "PROBATION_PASSED",
                    Name = "Probation Passed",
                    Description = "Completed probation.",
                    IsActive = true,
                    CreatedAt = createdAt,
                    UpdatedAt = updatedAt
                }
            });

        var result = await _handler.Handle(new GetCommissionMilestonesQuery(true), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().ContainSingle();
        result.Data[0].Code.Should().Be("PROBATION_PASSED");
        result.Data[0].CreatedAt.Should().Be(createdAt);
        _milestones.Verify(repository => repository.GetListAsync(true, It.IsAny<CancellationToken>()), Times.Once);
    }
}
