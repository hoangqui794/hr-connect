using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.InternalHr.Commands.UpdateInternalHrProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.InternalHr;

public class UpdateInternalHrProfileCommandHandlerTests
{
    private readonly Mock<IInternalHrProfileRepository> _internalHrProfileRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<ILogger<UpdateInternalHrProfileCommandHandler>> _loggerMock;
    private readonly UpdateInternalHrProfileCommandHandler _handler;

    public UpdateInternalHrProfileCommandHandlerTests()
    {
        _internalHrProfileRepositoryMock = new Mock<IInternalHrProfileRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _loggerMock = new Mock<ILogger<UpdateInternalHrProfileCommandHandler>>();

        _phoneNormalizerMock
            .Setup(p => p.Normalize(It.IsAny<string?>()))
            .Returns<string?>(s => s != null ? "+84" + s.Trim().TrimStart('0', '+') : null);

        _handler = new UpdateInternalHrProfileCommandHandler(
            _internalHrProfileRepositoryMock.Object,
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
        var hrProfileId = Guid.NewGuid();

        var existingUser = new AppUser
        {
            UserId = userId,
            Email = "hr.test@agency.com",
            DisplayName = "Old Name",
            Phone = "0912345678",
            NormalizedPhone = "+84912345678",
            AvatarUrl = "https://example.com/avatar.png",
            Status = "ACTIVE"
        };

        var existingProfile = new InternalHrProfile
        {
            HrProfileId = hrProfileId,
            UserId = userId,
            EmployeeCode = "HR001",
            Department = "Phòng Tuyển dụng Cũ",
            JobTitle = "Junior Recruiter",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-60),
            UpdatedAt = DateTime.UtcNow.AddDays(-10),
            User = existingUser
        };

        _internalHrProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateInternalHrProfileCommand
        {
            UserId = userId,
            DisplayName = "Nguyễn Văn Chuyên Nghiệp",
            Phone = "0987654321",
            Department = "Khối Săn Đầu Người IT",
            JobTitle = "Senior Headhunter Lead"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật hồ sơ nhân sự Agency thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.HrProfileId.Should().Be(hrProfileId);
        result.Data.UserId.Should().Be(userId);
        result.Data.Email.Should().Be("hr.test@agency.com");
        result.Data.DisplayName.Should().Be("Nguyễn Văn Chuyên Nghiệp");
        result.Data.Phone.Should().Be("0987654321");
        result.Data.Department.Should().Be("Khối Săn Đầu Người IT");
        result.Data.JobTitle.Should().Be("Senior Headhunter Lead");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.EmployeeCode.Should().Be("HR001");

        _internalHrProfileRepositoryMock.Verify(r => r.Update(existingProfile), Times.Once);
        _userRepositoryMock.Verify(r => r.Update(existingUser), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenProfileNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _internalHrProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((InternalHrProfile?)null);

        var command = new UpdateInternalHrProfileCommand
        {
            UserId = userId,
            DisplayName = "Ai Đó"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin hồ sơ nhân sự*");

        _internalHrProfileRepositoryMock.Verify(r => r.Update(It.IsAny<InternalHrProfile>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenProfileStatusNotActive_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var existingProfile = new InternalHrProfile
        {
            HrProfileId = Guid.NewGuid(),
            UserId = userId,
            Status = "SUSPENDED"
        };

        _internalHrProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);

        var command = new UpdateInternalHrProfileCommand
        {
            UserId = userId,
            DisplayName = "Tên Mới"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Tài khoản nhân sự của bạn đang bị khóa hoặc không hoạt động*");

        _internalHrProfileRepositoryMock.Verify(r => r.Update(It.IsAny<InternalHrProfile>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenUserNotFound_ShouldStillUpdateProfileSuccessfully()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var hrProfileId = Guid.NewGuid();

        var existingProfile = new InternalHrProfile
        {
            HrProfileId = hrProfileId,
            UserId = userId,
            Status = "ACTIVE",
            Department = "Old Dept",
            JobTitle = "Old Title"
        };

        _internalHrProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);

        _userRepositoryMock
            .Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateInternalHrProfileCommand
        {
            UserId = userId,
            DisplayName = "Tên Mới",
            Department = "New Dept",
            JobTitle = "New Title"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.Department.Should().Be("New Dept");
        result.Data.JobTitle.Should().Be("New Title");

        _internalHrProfileRepositoryMock.Verify(r => r.Update(existingProfile), Times.Once);
        _userRepositoryMock.Verify(r => r.Update(It.IsAny<AppUser>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
