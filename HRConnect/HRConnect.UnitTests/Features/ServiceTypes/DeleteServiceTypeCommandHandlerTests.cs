using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.Commands.DeleteServiceType;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class DeleteServiceTypeCommandHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypeRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<DeleteServiceTypeCommandHandler>> _loggerMock;
    private readonly DeleteServiceTypeCommandHandler _handler;

    public DeleteServiceTypeCommandHandlerTests()
    {
        _serviceTypeRepositoryMock = new Mock<IServiceTypeRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<DeleteServiceTypeCommandHandler>>();

        _handler = new DeleteServiceTypeCommandHandler(
            _serviceTypeRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldDeleteServiceType_WhenNotReferenced()
    {
        // Arrange
        var id = Guid.NewGuid();
        var serviceType = new ServiceType
        {
            ServiceTypeId = id,
            Code = "UNUSED_SERVICE",
            Name = "Unused Service",
            IsActive = true
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(serviceType);

        _serviceTypeRepositoryMock.Setup(r => r.IsReferencedAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var command = new DeleteServiceTypeCommand(id);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.IsDeactivated.Should().BeFalse();
        result.Message.Should().Be("Service type deleted successfully.");

        _serviceTypeRepositoryMock.Verify(r => r.Delete(serviceType), Times.Once);
        _serviceTypeRepositoryMock.Verify(r => r.Update(It.IsAny<ServiceType>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldDeactivateServiceType_WhenReferenced()
    {
        // Arrange
        var id = Guid.NewGuid();
        var serviceType = new ServiceType
        {
            ServiceTypeId = id,
            Code = "HEADHUNT_COD",
            Name = "Headhunt COD",
            IsActive = true
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(serviceType);

        _serviceTypeRepositoryMock.Setup(r => r.IsReferencedAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var command = new DeleteServiceTypeCommand(id);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.IsDeactivated.Should().BeTrue();
        result.Message.Should().Be("Service type is in use and has been deactivated instead.");
        serviceType.IsActive.Should().BeFalse();

        _serviceTypeRepositoryMock.Verify(r => r.Update(It.Is<ServiceType>(st => st.ServiceTypeId == id && st.IsActive == false)), Times.Once);
        _serviceTypeRepositoryMock.Verify(r => r.Delete(It.IsAny<ServiceType>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFoundException_WhenServiceTypeDoesNotExist()
    {
        // Arrange
        var id = Guid.NewGuid();

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ServiceType?)null);

        var command = new DeleteServiceTypeCommand(id);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{id}*");

        _serviceTypeRepositoryMock.Verify(r => r.Delete(It.IsAny<ServiceType>()), Times.Never);
        _serviceTypeRepositoryMock.Verify(r => r.Update(It.IsAny<ServiceType>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
