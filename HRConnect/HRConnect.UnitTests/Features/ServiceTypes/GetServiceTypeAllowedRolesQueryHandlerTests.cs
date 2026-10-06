using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypeAllowedRoles;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class GetServiceTypeAllowedRolesQueryHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypes = new();
    private readonly GetServiceTypeAllowedRolesQueryHandler _handler;

    public GetServiceTypeAllowedRolesQueryHandlerTests() => _handler = new(_serviceTypes.Object);

    [Fact]
    public async Task Handle_ReturnsServiceTypeAndRoleMappings()
    {
        var serviceTypeId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        _serviceTypes.Setup(repository => repository.GetByIdAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceType { ServiceTypeId = serviceTypeId, Code = "HEADHUNT_COD", Name = "Headhunt COD" });
        _serviceTypes.Setup(repository => repository.GetAllowedRolesAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ServiceTypeAllowedRole>
            {
                new()
                {
                    ServiceTypeId = serviceTypeId,
                    RoleId = roleId,
                    CanView = true,
                    CanSubmit = true,
                    CreatedAt = DateTime.UtcNow.AddDays(-1),
                    UpdatedAt = DateTime.UtcNow,
                    Role = new Role { RoleId = roleId, Code = "AFFILIATE_RECRUITER", Name = "Affiliate Recruiter", IsActive = true }
                }
            });

        var result = await _handler.Handle(new(serviceTypeId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.ServiceTypeCode.Should().Be("HEADHUNT_COD");
        result.Data.Roles.Should().ContainSingle();
        result.Data.Roles[0].RoleCode.Should().Be("AFFILIATE_RECRUITER");
        result.Data.Roles[0].CanView.Should().BeTrue();
        result.Data.Roles[0].CanSubmit.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ThrowsNotFound_WhenServiceTypeDoesNotExist()
    {
        var id = Guid.NewGuid();
        _serviceTypes.Setup(repository => repository.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ServiceType?)null);

        var action = async () => await _handler.Handle(new(id), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
        _serviceTypes.Verify(repository => repository.GetAllowedRolesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
