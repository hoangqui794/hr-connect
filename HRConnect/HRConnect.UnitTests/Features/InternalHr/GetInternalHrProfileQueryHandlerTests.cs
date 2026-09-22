using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.InternalHr.Queries.GetInternalHrProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.InternalHr;

public class GetInternalHrProfileQueryHandlerTests
{
    private readonly Mock<IInternalHrProfileRepository> _internalHrProfileRepositoryMock;
    private readonly Mock<ILogger<GetInternalHrProfileQueryHandler>> _loggerMock;
    private readonly GetInternalHrProfileQueryHandler _handler;

    public GetInternalHrProfileQueryHandlerTests()
    {
        _internalHrProfileRepositoryMock = new Mock<IInternalHrProfileRepository>();
        _loggerMock = new Mock<ILogger<GetInternalHrProfileQueryHandler>>();
        _handler = new GetInternalHrProfileQueryHandler(_internalHrProfileRepositoryMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenProfileAndUserExist_ShouldReturnProfileData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var hrProfileId = Guid.NewGuid();
        var createdAt = DateTime.UtcNow.AddDays(-30);
        var updatedAt = DateTime.UtcNow;

        var user = new AppUser
        {
            UserId = userId,
            Email = "hr.specialist@agency.com",
            DisplayName = "Lê Thị Mai",
            Phone = "+84987654321",
            AvatarUrl = "https://example.com/avatar/hr.png",
            Status = "ACTIVE"
        };

        var profile = new InternalHrProfile
        {
            HrProfileId = hrProfileId,
            UserId = userId,
            EmployeeCode = "HR007",
            Department = "Ban Tuyển dụng Nhân tài IT",
            JobTitle = "Senior Talent Acquisition",
            Status = "ACTIVE",
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
            User = user
        };

        _internalHrProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var query = new GetInternalHrProfileQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lấy thông tin hồ sơ nhân sự Agency thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.HrProfileId.Should().Be(hrProfileId);
        result.Data.UserId.Should().Be(userId);
        result.Data.Email.Should().Be("hr.specialist@agency.com");
        result.Data.DisplayName.Should().Be("Lê Thị Mai");
        result.Data.Phone.Should().Be("+84987654321");
        result.Data.AvatarUrl.Should().Be("https://example.com/avatar/hr.png");
        result.Data.EmployeeCode.Should().Be("HR007");
        result.Data.Department.Should().Be("Ban Tuyển dụng Nhân tài IT");
        result.Data.JobTitle.Should().Be("Senior Talent Acquisition");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.CreatedAt.Should().Be(createdAt);
        result.Data.UpdatedAt.Should().Be(updatedAt);

        _internalHrProfileRepositoryMock.Verify(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenProfileNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _internalHrProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((InternalHrProfile?)null);

        var query = new GetInternalHrProfileQuery(userId);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin hồ sơ nhân sự*");

        _internalHrProfileRepositoryMock.Verify(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenUserIsNull_ShouldHandleGracefullyWithEmptyDefaults()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var hrProfileId = Guid.NewGuid();

        var profile = new InternalHrProfile
        {
            HrProfileId = hrProfileId,
            UserId = userId,
            EmployeeCode = null,
            Department = null,
            JobTitle = null,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            User = null!
        };

        _internalHrProfileRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var query = new GetInternalHrProfileQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Email.Should().BeEmpty();
        result.Data.DisplayName.Should().BeEmpty();
        result.Data.Phone.Should().BeNull();
        result.Data.AvatarUrl.Should().BeNull();
        result.Data.EmployeeCode.Should().BeNull();
        result.Data.Department.Should().BeNull();
        result.Data.JobTitle.Should().BeNull();
    }
}
