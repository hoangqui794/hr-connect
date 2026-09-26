using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CommissionRules.Commands.CreateCommissionRule;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CommissionRules;

public class CreateCommissionRuleCommandHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypes = new();
    private readonly Mock<ICommissionMilestoneRepository> _milestones = new();
    private readonly Mock<ICommissionRuleRepository> _rules = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly CreateCommissionRuleCommandHandler _handler;

    public CreateCommissionRuleCommandHandlerTests()
    {
        _handler = new(_serviceTypes.Object, _milestones.Object, _rules.Object, _unitOfWork.Object);
    }

    [Fact]
    public async Task Handle_CreatesActiveRule_WhenServiceTypeAndMilestoneAreActive()
    {
        var serviceTypeId = Guid.NewGuid();
        var effectiveFrom = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var command = new CreateCommissionRuleCommand
        {
            ServiceTypeId = serviceTypeId,
            MilestoneType = "probation_passed",
            RateType = "percent",
            RateValue = 8,
            WarrantyRequired = false,
            EffectiveFrom = effectiveFrom,
            IsActive = true
        };
        _serviceTypes.Setup(repository => repository.GetByIdAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceType { ServiceTypeId = serviceTypeId, Code = "HEADHUNT_COD", IsActive = true });
        _milestones.Setup(repository => repository.GetByCodeAsync("PROBATION_PASSED", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CommissionMilestone { MilestoneCode = "PROBATION_PASSED", IsActive = true });
        _rules.Setup(repository => repository.ExistsActiveAtEffectiveFromAsync(
                serviceTypeId, "PROBATION_PASSED", effectiveFrom, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _handler.Handle(command, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.ServiceTypeCode.Should().Be("HEADHUNT_COD");
        result.Data.MilestoneType.Should().Be("PROBATION_PASSED");
        result.Data.RateType.Should().Be("PERCENT");
        result.Data.RateValue.Should().Be(8);
        _rules.Verify(repository => repository.AddAsync(
            It.Is<CommissionRule>(rule =>
                rule.ServiceTypeId == serviceTypeId &&
                rule.MilestoneType == "PROBATION_PASSED" &&
                rule.RateType == "PERCENT" &&
                rule.EffectiveFrom == effectiveFrom),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_RejectsInactiveServiceType()
    {
        var command = new CreateCommissionRuleCommand
        {
            ServiceTypeId = Guid.NewGuid(),
            MilestoneType = "PROBATION_PASSED",
            RateType = "PERCENT",
            RateValue = 8
        };
        _serviceTypes.Setup(repository => repository.GetByIdAsync(command.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceType { ServiceTypeId = command.ServiceTypeId, IsActive = false });

        var action = async () => await _handler.Handle(command, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
        _milestones.Verify(repository => repository.GetByCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _rules.Verify(repository => repository.AddAsync(It.IsAny<CommissionRule>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RejectsDuplicateActiveRuleAtTheSameEffectiveTime()
    {
        var serviceTypeId = Guid.NewGuid();
        var effectiveFrom = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var command = new CreateCommissionRuleCommand
        {
            ServiceTypeId = serviceTypeId,
            MilestoneType = "PROBATION_PASSED",
            RateType = "PERCENT",
            RateValue = 8,
            EffectiveFrom = effectiveFrom,
            IsActive = true
        };
        _serviceTypes.Setup(repository => repository.GetByIdAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceType { ServiceTypeId = serviceTypeId, Code = "HEADHUNT_COD", IsActive = true });
        _milestones.Setup(repository => repository.GetByCodeAsync("PROBATION_PASSED", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CommissionMilestone { MilestoneCode = "PROBATION_PASSED", IsActive = true });
        _rules.Setup(repository => repository.ExistsActiveAtEffectiveFromAsync(
                serviceTypeId, "PROBATION_PASSED", effectiveFrom, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var action = async () => await _handler.Handle(command, CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
        _rules.Verify(repository => repository.AddAsync(It.IsAny<CommissionRule>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
