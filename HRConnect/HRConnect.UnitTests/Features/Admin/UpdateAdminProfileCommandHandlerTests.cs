using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.Commands.UpdateAdminProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin;

public class UpdateAdminProfileCommandHandlerTests
{
    private readonly Mock<IAdminProfileRepository> _adminProfileRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<ILogger<UpdateAdminProfileCommandHandler>> _loggerMock;
    private readonly UpdateAdminProfileCommandHandler _handler;

    public UpdateAdminProfileCommandHandlerTests()
    {
        _adminProfileRepositoryMock = new Mock<IAdminProfileRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _loggerMock = new Mock<ILogger<UpdateAdminProfileCommandHandler>>();

        _phoneNormalizerMock
            .Setup(p => p.Normalize(It.IsAny<string?>()))
            .Returns<string?>(s => s != null ? "+84" + s.Trim().TrimStart('0', '+') : null);

        _handler = new UpdateAdminProfileCommandHandler(
            _adminProfileRepositoryMock.Object,
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _phoneNormalizerMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenValidRequest_ShouldUpdateProfileAndUserSuccessfully()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var adminProfileId = Guid.NewGuid();

        var existingUser = new AppUser
        {
            UserId = userId,
            Email = "admin.test@hrconnect.vn",
            DisplayName = "Old Admin Name",
            Phone = "0901234567",
            NormalizedPhone = "+84901234567",
            AvatarUrl = "https://example.com/avatar.png",
            Status = "ACTIVE"
        };

        var existingProfile = new AdminProfile
        {
            AdminProfileId = adminProfileId,
            UserId = userId,
            EmployeeCode = "ADM001",
            JobTitle = "System Admin",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-60),
            UpdatedAt = DateTime.UtcNow.AddDays(-10),
            User = existingUser
        };

        _adminProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateAdminProfileCommand
        {
            UserId = userId,
            DisplayName = "Nguyễn Văn Admin Mới",
            Phone = "0987654321",
            JobTitle = "Chief Technology Administrator"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật hồ sơ quản trị viên thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.AdminProfileId.Should().Be(adminProfileId);
        result.Data.UserId.Should().Be(userId);
        result.Data.Email.Should().Be("admin.test@hrconnect.vn");
        result.Data.DisplayName.Should().Be("Nguyễn Văn Admin Mới");
        result.Data.Phone.Should().Be("0987654321");
        result.Data.JobTitle.Should().Be("Chief Technology Administrator");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.EmployeeCode.Should().Be("ADM001");

        _adminProfileRepositoryMock.Verify(r => r.Update(existingProfile), Times.Once);
        _userRepositoryMock.Verify(r => r.Update(existingUser), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenProfileNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _adminProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AdminProfile?)null);

        var command = new UpdateAdminProfileCommand
        {
            UserId = userId,
            DisplayName = "Admin Vô Danh"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin hồ sơ quản trị viên*");

        _adminProfileRepositoryMock.Verify(r => r.Update(It.IsAny<AdminProfile>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenProfileStatusNotActive_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var existingProfile = new AdminProfile
        {
            AdminProfileId = Guid.NewGuid(),
            UserId = userId,
            Status = "SUSPENDED"
        };

        _adminProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);

        var command = new UpdateAdminProfileCommand
        {
            UserId = userId,
            DisplayName = "Admin Khóa"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Tài khoản quản trị viên của bạn đang bị khóa hoặc không hoạt động*");

        _adminProfileRepositoryMock.Verify(r => r.Update(It.IsAny<AdminProfile>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenUserNotFound_ShouldStillUpdateProfileSuccessfully()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var adminProfileId = Guid.NewGuid();

        var existingProfile = new AdminProfile
        {
            AdminProfileId = adminProfileId,
            UserId = userId,
            Status = "ACTIVE",
            JobTitle = "Old Job Title"
        };

        _adminProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateAdminProfileCommand
        {
            UserId = userId,
            DisplayName = "Tên Mới",
            JobTitle = "New Job Title"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.JobTitle.Should().Be("New Job Title");

        _adminProfileRepositoryMock.Verify(r => r.Update(existingProfile), Times.Once);
        _userRepositoryMock.Verify(r => r.Update(It.IsAny<AppUser>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
