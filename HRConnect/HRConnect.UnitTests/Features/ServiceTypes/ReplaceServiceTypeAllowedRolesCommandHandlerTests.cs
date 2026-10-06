using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.Commands.ReplaceServiceTypeAllowedRoles;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class ReplaceServiceTypeAllowedRolesCommandHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypes = new();
    private readonly Mock<IRoleRepository> _roles = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly ReplaceServiceTypeAllowedRolesCommandHandler _handler;

    public ReplaceServiceTypeAllowedRolesCommandHandlerTests()
    {
        _handler = new(_serviceTypes.Object, _roles.Object, _unitOfWork.Object);
    }

    [Fact]
    public async Task Handle_ReplacesMappingsAndSaves_WhenAllRolesExist()
    {
        var serviceTypeId = Guid.NewGuid();
        var affiliateRoleId = Guid.NewGuid();
        var candidateRoleId = Guid.NewGuid();
        var command = new ReplaceServiceTypeAllowedRolesCommand
        {
            ServiceTypeId = serviceTypeId,
            Roles = new[]
            {
                new AllowedRoleInput(affiliateRoleId, true, true),
                new AllowedRoleInput(candidateRoleId, false, false)
            }
        };

        _serviceTypes.Setup(repository => repository.GetByIdAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceType { ServiceTypeId = serviceTypeId, Code = "HEADHUNT_COD" });
        _roles.Setup(repository => repository.GetByIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Role>
            {
                new() { RoleId = affiliateRoleId, Code = "AFFILIATE_RECRUITER" },
                new() { RoleId = candidateRoleId, Code = "CANDIDATE" }
            });

        var result = await _handler.Handle(command, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.ServiceTypeCode.Should().Be("HEADHUNT_COD");
        result.Data.Roles.Should().BeEquivalentTo(new[]
        {
            new UpdatedAllowedRoleDto(affiliateRoleId, true, true),
            new UpdatedAllowedRoleDto(candidateRoleId, false, false)
        });
        _serviceTypes.Verify(repository => repository.ReplaceAllowedRolesAsync(
            serviceTypeId,
            It.Is<IReadOnlyCollection<ServiceTypeAllowedRole>>(mappings =>
                mappings.Count == 2 &&
                mappings.Any(mapping => mapping.RoleId == affiliateRoleId && mapping.CanView && mapping.CanSubmit) &&
                mappings.Any(mapping => mapping.RoleId == candidateRoleId && !mapping.CanView && !mapping.CanSubmit)),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ThrowsNotFound_WhenServiceTypeDoesNotExist()
    {
        var command = new ReplaceServiceTypeAllowedRolesCommand { ServiceTypeId = Guid.NewGuid() };
        _serviceTypes.Setup(repository => repository.GetByIdAsync(command.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ServiceType?)null);

        var action = async () => await _handler.Handle(command, CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
        _roles.Verify(repository => repository.GetByIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()), Times.Never);
        _serviceTypes.Verify(repository => repository.ReplaceAllowedRolesAsync(
            It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<ServiceTypeAllowedRole>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ThrowsBadRequest_WhenAnyRoleDoesNotExist()
    {
        var serviceTypeId = Guid.NewGuid();
        var requestedRoleId = Guid.NewGuid();
        var command = new ReplaceServiceTypeAllowedRolesCommand
        {
            ServiceTypeId = serviceTypeId,
            Roles = new[] { new AllowedRoleInput(requestedRoleId, true, false) }
        };
        _serviceTypes.Setup(repository => repository.GetByIdAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceType { ServiceTypeId = serviceTypeId, Code = "CV_APPLICATION" });
        _roles.Setup(repository => repository.GetByIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Role>());

        var action = async () => await _handler.Handle(command, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
        _serviceTypes.Verify(repository => repository.ReplaceAllowedRolesAsync(
            It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<ServiceTypeAllowedRole>>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
