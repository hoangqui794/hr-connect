using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CommissionRules.Commands.DeactivateCommissionRule;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CommissionRules;

public class DeactivateCommissionRuleCommandHandlerTests
{
    private readonly Mock<ICommissionRuleRepository> _rules = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly DeactivateCommissionRuleCommandHandler _handler;

    public DeactivateCommissionRuleCommandHandlerTests() => _handler = new(_rules.Object, _unitOfWork.Object);

    [Fact]
    public async Task Handle_DeactivatesActiveRuleWithoutDeletingIt()
    {
        var rule = new CommissionRule { CommissionRuleId = Guid.NewGuid(), IsActive = true, UpdatedAt = DateTime.UtcNow };
        _rules.Setup(repository => repository.GetForUpdateAsync(rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);

        var result = await _handler.Handle(new DeactivateCommissionRuleCommand(rule.CommissionRuleId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.IsActive.Should().BeFalse();
        rule.IsActive.Should().BeFalse();
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_IsIdempotentForAnAlreadyInactiveRule()
    {
        var rule = new CommissionRule { CommissionRuleId = Guid.NewGuid(), IsActive = false, UpdatedAt = DateTime.UtcNow };
        _rules.Setup(repository => repository.GetForUpdateAsync(rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);

        var result = await _handler.Handle(new DeactivateCommissionRuleCommand(rule.CommissionRuleId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.IsActive.Should().BeFalse();
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ThrowsNotFoundWhenRuleDoesNotExist()
    {
        _rules.Setup(repository => repository.GetForUpdateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CommissionRule?)null);

        var action = () => _handler.Handle(new DeactivateCommissionRuleCommand(Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }
}
