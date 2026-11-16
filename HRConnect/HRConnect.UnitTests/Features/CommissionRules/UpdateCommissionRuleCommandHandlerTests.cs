using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.CommissionRules.Commands.UpdateCommissionRule;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CommissionRules;

public class UpdateCommissionRuleCommandHandlerTests
{
    private readonly Mock<ICommissionRuleRepository> _rules = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _auditLogService = new();
    private readonly UpdateCommissionRuleCommandHandler _handler;

    public UpdateCommissionRuleCommandHandlerTests() =>
        _handler = new(_rules.Object, _unitOfWork.Object, _auditLogService.Object);

    [Fact]
    public async Task Handle_UpdatesEditableConfigurationAndPreservesRuleIdentity()
    {
        var rule = CreateRule();
        _rules.Setup(repository => repository.GetForUpdateAsync(rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);
        _rules.Setup(repository => repository.ExistsAnotherActiveAtEffectiveFromAsync(
                rule.ServiceTypeId, rule.MilestoneType!, It.IsAny<DateTime>(), rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        AuditEntry? capturedAudit = null;
        _auditLogService.Setup(audit => audit.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
            .Callback<AuditEntry, CancellationToken>((entry, _) => capturedAudit = entry)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new UpdateCommissionRuleCommand
        {
            CommissionRuleId = rule.CommissionRuleId,
            RateType = "fixed",
            RateValue = 2_000_000,
            WarrantyRequired = true,
            EffectiveFrom = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            EffectiveTo = new DateTime(2027, 11, 1, 0, 0, 0, DateTimeKind.Utc)
        }, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.RateType.Should().Be("FIXED");
        result.Data.RateValue.Should().Be(2_000_000);
        result.Data.ServiceTypeId.Should().Be(rule.ServiceTypeId);
        result.Data.MilestoneType.Should().Be("PROBATION_PASSED");
        capturedAudit.Should().NotBeNull();
        capturedAudit!.Action.Should().Be(AuditActions.CommissionRuleUpdated);
        capturedAudit.EntityType.Should().Be("COMMISSION_RULE");
        capturedAudit.EntityId.Should().Be(rule.CommissionRuleId);
        JsonSerializer.Serialize(capturedAudit.OldValues).Should().Contain("\"rateType\":\"PERCENT\"").And.Contain("\"rateValue\":8");
        JsonSerializer.Serialize(capturedAudit.NewValues).Should().Contain("\"rateType\":\"FIXED\"").And.Contain("\"rateValue\":2000000");
        _auditLogService.Verify(audit => audit.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ThrowsConflictWhenEffectiveTimeCollidesWithAnotherActiveRule()
    {
        var rule = CreateRule();
        _rules.Setup(repository => repository.GetForUpdateAsync(rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);
        _rules.Setup(repository => repository.ExistsAnotherActiveAtEffectiveFromAsync(
                rule.ServiceTypeId, rule.MilestoneType!, It.IsAny<DateTime>(), rule.CommissionRuleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var action = () => _handler.Handle(new UpdateCommissionRuleCommand
        {
            CommissionRuleId = rule.CommissionRuleId,
            RateType = "PERCENT",
            RateValue = 8,
            EffectiveFrom = DateTime.UtcNow
        }, CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        _auditLogService.Verify(audit => audit.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ThrowsNotFoundWhenRuleDoesNotExist()
    {
        _rules.Setup(repository => repository.GetForUpdateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CommissionRule?)null);

        var action = () => _handler.Handle(new UpdateCommissionRuleCommand
        {
            CommissionRuleId = Guid.NewGuid(),
            RateType = "PERCENT",
            RateValue = 8,
            EffectiveFrom = DateTime.UtcNow
        }, CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }

    private static CommissionRule CreateRule()
    {
        var serviceTypeId = Guid.NewGuid();
        return new CommissionRule
        {
            CommissionRuleId = Guid.NewGuid(),
            ServiceTypeId = serviceTypeId,
            Name = "HEADHUNT_COD - PROBATION_PASSED",
            MilestoneType = "PROBATION_PASSED",
            RateType = "PERCENT",
            RateValue = 8,
            EffectiveFrom = DateTime.UtcNow,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            ServiceType = new ServiceType { ServiceTypeId = serviceTypeId, Code = "HEADHUNT_COD", Name = "Headhunt COD" },
            MilestoneTypeNavigation = new CommissionMilestone { MilestoneCode = "PROBATION_PASSED", Name = "Qua thu viec" }
        };
    }
}
