using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypeDetail;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class GetServiceTypeDetailQueryHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypeRepositoryMock;
    private readonly GetServiceTypeDetailQueryHandler _handler;

    public GetServiceTypeDetailQueryHandlerTests()
    {
        _serviceTypeRepositoryMock = new Mock<IServiceTypeRepository>();
        _handler = new GetServiceTypeDetailQueryHandler(_serviceTypeRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnServiceTypeDto_WhenIdExists()
    {
        // Arrange
        var id = Guid.NewGuid();
        var entity = new ServiceType
        {
            ServiceTypeId = id,
            Code = "HEADHUNT_COD",
            Name = "Headhunt COD",
            Description = "Commission-based headhunting service",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(entity);

        // Act
        var result = await _handler.Handle(new GetServiceTypeDetailQuery(id), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Id.Should().Be(id);
        result.Data.Code.Should().Be("HEADHUNT_COD");
        result.Data.Name.Should().Be("Headhunt COD");
        result.Data.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFoundException_WhenIdDoesNotExist()
    {
        // Arrange
        var id = Guid.NewGuid();
        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ServiceType?)null);

        // Act
        var act = async () => await _handler.Handle(new GetServiceTypeDetailQuery(id), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{id}*");
    }
}
