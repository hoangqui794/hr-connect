using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypes;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class GetServiceTypesQueryHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypeRepositoryMock;
    private readonly GetServiceTypesQueryHandler _handler;

    public GetServiceTypesQueryHandlerTests()
    {
        _serviceTypeRepositoryMock = new Mock<IServiceTypeRepository>();
        _handler = new GetServiceTypesQueryHandler(_serviceTypeRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnListOfServiceTypes_WhenCalled()
    {
        // Arrange
        var list = new List<ServiceType>
        {
            new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_APPLICATION", Name = "CV Application", Description = "Desc 1", IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "HEADHUNT_COD", Name = "Headhunt COD", Description = "Desc 2", IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetListAsync(
            It.IsAny<string?>(),
            It.IsAny<bool?>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<int>(),
            It.IsAny<int>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync((list, 2));

        var query = new GetServiceTypesQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Items.Should().HaveCount(2);
        result.Data.Total.Should().Be(2);
        result.Data.Items.First().Code.Should().Be("CV_APPLICATION");
    }

    [Fact]
    public async Task Handle_ShouldPassActiveFilterAndSearch_ToRepository()
    {
        // Arrange
        _serviceTypeRepositoryMock.Setup(r => r.GetListAsync(
            "headhunt",
            true,
            "name",
            "asc",
            1,
            20,
            It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<ServiceType>(), 0));

        var query = new GetServiceTypesQuery(Search: "headhunt", IsActive: true);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        _serviceTypeRepositoryMock.Verify(r => r.GetListAsync(
            "headhunt",
            true,
            "name",
            "asc",
            1,
            20,
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
