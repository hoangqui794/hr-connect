using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CommissionRules.Commands.ActivateCommissionRule;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CommissionRules;

public class ActivateCommissionRuleCommandHandlerTests
{
    private readonly Mock<ICommissionRuleRepository> _rules = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly ActivateCommissionRuleCommandHandler _handler;

    public ActivateCommissionRuleCommandHandlerTests() => _handler = new(_rules.Object, _unitOfWork.Object);

    [Fact]
    public async Task Handle_ActivatesInactiveRuleWhenNoActiveRuleConflicts()
    {
        var rule = CreateRule(isActive: false);
        _rules.Setup(repository => repository.GetForUpdateAsync(rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);
        _rules.Setup(repository => repository.ExistsAnotherActiveAtEffectiveFromAsync(
                rule.ServiceTypeId, rule.MilestoneType!, rule.EffectiveFrom!.Value,
                rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _handler.Handle(new ActivateCommissionRuleCommand(rule.CommissionRuleId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.IsActive.Should().BeTrue();
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ThrowsConflictWhenAnotherActiveRuleHasTheSameIdentity()
    {
        var rule = CreateRule(isActive: false);
        _rules.Setup(repository => repository.GetForUpdateAsync(rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);
        _rules.Setup(repository => repository.ExistsAnotherActiveAtEffectiveFromAsync(
                rule.ServiceTypeId, rule.MilestoneType!, rule.EffectiveFrom!.Value,
                rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var action = () => _handler.Handle(new ActivateCommissionRuleCommand(rule.CommissionRuleId), CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_IsIdempotentWhenRuleIsAlreadyActive()
    {
        var rule = CreateRule(isActive: true);
        _rules.Setup(repository => repository.GetForUpdateAsync(rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);

        var result = await _handler.Handle(new ActivateCommissionRuleCommand(rule.CommissionRuleId), CancellationToken.None);

        result.Data.IsActive.Should().BeTrue();
        _rules.Verify(repository => repository.ExistsAnotherActiveAtEffectiveFromAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ThrowsNotFoundWhenRuleDoesNotExist()
    {
        _rules.Setup(repository => repository.GetForUpdateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CommissionRule?)null);

        var action = () => _handler.Handle(new ActivateCommissionRuleCommand(Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }

    private static CommissionRule CreateRule(bool isActive)
    {
        return new CommissionRule
        {
            CommissionRuleId = Guid.NewGuid(),
            ServiceTypeId = Guid.NewGuid(),
            MilestoneType = "PROBATION_PASSED",
            EffectiveFrom = new DateTime(2026, 9, 26, 0, 0, 0, DateTimeKind.Utc),
            IsActive = isActive,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
