using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.Commands.UpdateServiceType;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class UpdateServiceTypeCommandHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypeRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<UpdateServiceTypeCommandHandler>> _loggerMock;
    private readonly UpdateServiceTypeCommandHandler _handler;

    public UpdateServiceTypeCommandHandlerTests()
    {
        _serviceTypeRepositoryMock = new Mock<IServiceTypeRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<UpdateServiceTypeCommandHandler>>();

        _handler = new UpdateServiceTypeCommandHandler(
            _serviceTypeRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldUpdateServiceType_WhenValid()
    {
        // Arrange
        var id = Guid.NewGuid();
        var existing = new ServiceType
        {
            ServiceTypeId = id,
            Code = "HEADHUNT_COD",
            Name = "Old Name",
            Description = "Old Desc",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var command = new UpdateServiceTypeCommand
        {
            Id = id,
            Code = "HEADHUNT_COD", // same code
            Name = "New Name",
            Description = "New Desc",
            IsActive = false
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.Name.Should().Be("New Name");
        result.Data.Description.Should().Be("New Desc");
        result.Data.IsActive.Should().BeFalse();

        _serviceTypeRepositoryMock.Verify(r => r.Update(existing), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFoundException_WhenServiceTypeDoesNotExist()
    {
        // Arrange
        var id = Guid.NewGuid();
        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ServiceType?)null);

        var command = new UpdateServiceTypeCommand
        {
            Id = id,
            Code = "SOME_CODE",
            Name = "Some Name"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{id}*");
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenChangingCodeOnReferencedServiceType()
    {
        // Arrange
        var id = Guid.NewGuid();
        var existing = new ServiceType
        {
            ServiceTypeId = id,
            Code = "OLD_CODE",
            Name = "Service",
            IsActive = true
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        _serviceTypeRepositoryMock.Setup(r => r.IsReferencedAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true); // Referenced by Job or CommissionRule!

        var command = new UpdateServiceTypeCommand
        {
            Id = id,
            Code = "NEW_CODE",
            Name = "Service"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Không thể thay đổi mã loại dịch vụ*");
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenNewCodeAlreadyExistsOnAnotherServiceType()
    {
        // Arrange
        var id = Guid.NewGuid();
        var existing = new ServiceType
        {
            ServiceTypeId = id,
            Code = "OLD_CODE",
            Name = "Service",
            IsActive = true
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        _serviceTypeRepositoryMock.Setup(r => r.IsReferencedAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false); // not referenced

        _serviceTypeRepositoryMock.Setup(r => r.ExistsByCodeAsync("NEW_CODE", id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true); // but NEW_CODE already taken!

        var command = new UpdateServiceTypeCommand
        {
            Id = id,
            Code = "NEW_CODE",
            Name = "Service"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*NEW_CODE*");
    }

    [Fact]
    public async Task Handle_ShouldAllowChangingCode_WhenNotReferencedAndUnique()
    {
        // Arrange
        var id = Guid.NewGuid();
        var existing = new ServiceType
        {
            ServiceTypeId = id,
            Code = "OLD_CODE",
            Name = "Service",
            IsActive = true
        };

        _serviceTypeRepositoryMock.Setup(r => r.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        _serviceTypeRepositoryMock.Setup(r => r.IsReferencedAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _serviceTypeRepositoryMock.Setup(r => r.ExistsByCodeAsync("NEW_CODE", id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var command = new UpdateServiceTypeCommand
        {
            Id = id,
            Code = "new_code",
            Name = "Updated Name"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Code.Should().Be("NEW_CODE");
        existing.Code.Should().Be("NEW_CODE");
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
