using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetActiveSkills;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class GetActiveSkillsQueryHandlerTests
{
    [Fact]
    public async Task Handle_ClampsPagingAndReturnsActiveSkillDtos()
    {
        var skillRepository = new Mock<ISkillRepository>();
        skillRepository.Setup(repository => repository.GetActiveAsync("net", 1, 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([
                new Skill
                {
                    SkillId = Guid.NewGuid(),
                    SkillName = ".NET",
                    NormalizedName = ".NET",
                    Category = "Backend",
                    IsActive = true
                }
            ], 1));
        var handler = new GetActiveSkillsQueryHandler(skillRepository.Object);

        var result = await handler.Handle(new GetActiveSkillsQuery("net", 0, 999), CancellationToken.None);

        result.Page.Should().Be(1);
        result.PageSize.Should().Be(100);
        result.TotalPages.Should().Be(1);
        result.Items.Should().ContainSingle(item => item.SkillName == ".NET");
    }
}
