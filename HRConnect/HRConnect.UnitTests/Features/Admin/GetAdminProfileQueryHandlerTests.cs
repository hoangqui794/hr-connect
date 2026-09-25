using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.Queries.GetAdminProfile;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin;

public class GetAdminProfileQueryHandlerTests
{
    private readonly Mock<IAdminProfileRepository> _adminProfileRepositoryMock;
    private readonly GetAdminProfileQueryHandler _handler;

    public GetAdminProfileQueryHandlerTests()
    {
        _adminProfileRepositoryMock = new Mock<IAdminProfileRepository>();
        _handler = new GetAdminProfileQueryHandler(_adminProfileRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_WhenProfileAndUserExist_ShouldReturnProfileData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var adminProfileId = Guid.NewGuid();
        var createdAt = DateTime.UtcNow.AddDays(-90);
        var updatedAt = DateTime.UtcNow;

        var user = new AppUser
        {
            UserId = userId,
            Email = "admin@hrconnect.vn",
            DisplayName = "Nguyễn Văn Admin",
            Phone = "+84901234567",
            AvatarUrl = "https://example.com/avatar/admin.png",
            Status = "ACTIVE"
        };

        var profile = new AdminProfile
        {
            AdminProfileId = adminProfileId,
            UserId = userId,
            EmployeeCode = "ADM001",
            JobTitle = "Platform Administrator",
            Status = "ACTIVE",
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
            User = user
        };

        _adminProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var query = new GetAdminProfileQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lấy thông tin hồ sơ quản trị viên thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.AdminProfileId.Should().Be(adminProfileId);
        result.Data.UserId.Should().Be(userId);
        result.Data.Email.Should().Be("admin@hrconnect.vn");
        result.Data.DisplayName.Should().Be("Nguyễn Văn Admin");
        result.Data.Phone.Should().Be("+84901234567");
        result.Data.AvatarUrl.Should().Be("https://example.com/avatar/admin.png");
        result.Data.EmployeeCode.Should().Be("ADM001");
        result.Data.JobTitle.Should().Be("Platform Administrator");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.CreatedAt.Should().Be(createdAt);
        result.Data.UpdatedAt.Should().Be(updatedAt);

        _adminProfileRepositoryMock.Verify(
            r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_WhenProfileNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _adminProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AdminProfile?)null);

        var query = new GetAdminProfileQuery(userId);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ quản trị viên*");

        _adminProfileRepositoryMock.Verify(
            r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_WhenUserNavigationPropertyIsNull_ShouldReturnNullableFields()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var adminProfileId = Guid.NewGuid();

        var profile = new AdminProfile
        {
            AdminProfileId = adminProfileId,
            UserId = userId,
            EmployeeCode = null,
            JobTitle = null,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            User = null!
        };

        _adminProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var query = new GetAdminProfileQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Email.Should().BeNull();
        result.Data.DisplayName.Should().BeNull();
        result.Data.Phone.Should().BeNull();
        result.Data.AvatarUrl.Should().BeNull();
        result.Data.EmployeeCode.Should().BeNull();
        result.Data.JobTitle.Should().BeNull();
    }
}
