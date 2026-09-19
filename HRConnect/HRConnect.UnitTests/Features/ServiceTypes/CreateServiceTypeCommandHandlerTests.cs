using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.Commands.CreateServiceType;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class CreateServiceTypeCommandHandlerTests
{
    private readonly Mock<IServiceTypeRepository> _serviceTypeRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<CreateServiceTypeCommandHandler>> _loggerMock;
    private readonly CreateServiceTypeCommandHandler _handler;

    public CreateServiceTypeCommandHandlerTests()
    {
        _serviceTypeRepositoryMock = new Mock<IServiceTypeRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<CreateServiceTypeCommandHandler>>();

        _handler = new CreateServiceTypeCommandHandler(
            _serviceTypeRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldCreateServiceType_WhenValid()
    {
        // Arrange
        var command = new CreateServiceTypeCommand
        {
            Code = "executive_search",
            Name = "Executive Search",
            Description = "Executive search service"
        };

        _serviceTypeRepositoryMock.Setup(r => r.ExistsByCodeAsync("EXECUTIVE_SEARCH", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Code.Should().Be("EXECUTIVE_SEARCH");
        result.Data.Name.Should().Be("Executive Search");
        result.Data.IsActive.Should().BeTrue();

        _serviceTypeRepositoryMock.Verify(r => r.AddAsync(It.Is<ServiceType>(st => st.Code == "EXECUTIVE_SEARCH"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenCodeAlreadyExists()
    {
        // Arrange
        var command = new CreateServiceTypeCommand
        {
            Code = "HEADHUNT_COD",
            Name = "Headhunt COD"
        };

        _serviceTypeRepositoryMock.Setup(r => r.ExistsByCodeAsync("HEADHUNT_COD", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*HEADHUNT_COD*");

        _serviceTypeRepositoryMock.Verify(r => r.AddAsync(It.IsAny<ServiceType>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenDbUpdateExceptionOccurs()
    {
        // Arrange
        var command = new CreateServiceTypeCommand
        {
            Code = "CONCURRENT_CODE",
            Name = "Concurrent Service"
        };

        _serviceTypeRepositoryMock.Setup(r => r.ExistsByCodeAsync("CONCURRENT_CODE", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateException("Duplicate key violation"));

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*CONCURRENT_CODE*");
    }
}
