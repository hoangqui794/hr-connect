using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Companies;

public class UpdateCompanyProfileCommandHandlerTests
{
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock;
    private readonly Mock<ICompanyRepository> _companyRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<UpdateCompanyProfileCommandHandler>> _loggerMock;
    private readonly UpdateCompanyProfileCommandHandler _handler;

    public UpdateCompanyProfileCommandHandlerTests()
    {
        _companyUserRepositoryMock = new Mock<ICompanyUserRepository>();
        _companyRepositoryMock = new Mock<ICompanyRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<UpdateCompanyProfileCommandHandler>>();

        _handler = new UpdateCompanyProfileCommandHandler(
            _companyUserRepositoryMock.Object,
            _companyRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenValidRequest_ShouldUpdateCompanySuccessfully()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var existingCompany = new Company
        {
            CompanyId = companyId,
            CompanyName = "Old Company Name",
            TaxCode = "0101234567",
            Industry = "Finance",
            CompanySize = "50-100",
            Website = "https://oldcompany.com",
            Address = "123 Old St",
            Description = "Old description",
            VerificationStatus = "VERIFIED",
            VerifiedAt = DateTime.UtcNow.AddDays(-10),
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-5)
        };

        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = companyId,
            UserId = userId,
            RoleInCompany = "HR_DIRECTOR",
            IsPrimaryContact = true,
            Status = "ACTIVE",
            Company = existingCompany
        };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        _companyRepositoryMock
            .Setup(r => r.ExistsByTaxCodeAsync("0109999999", companyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateCompanyProfileCommand
        {
            UserId = userId,
            CompanyName = "New Công Ty TNHH",
            TaxCode = "0109999999",
            Industry = "Công nghệ cao",
            CompanySize = "100-500 nhân sự",
            Website = "https://newcompany.vn",
            Address = "456 Đường Mới, Quận 1, TP.HCM",
            Description = "Mô tả công ty mới cập nhật."
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật hồ sơ doanh nghiệp thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.CompanyId.Should().Be(companyId);
        result.Data.CompanyName.Should().Be("New Công Ty TNHH");
        result.Data.TaxCode.Should().Be("0109999999");
        result.Data.Industry.Should().Be("Công nghệ cao");
        result.Data.CompanySize.Should().Be("100-500 nhân sự");
        result.Data.Website.Should().Be("https://newcompany.vn");
        result.Data.Address.Should().Be("456 Đường Mới, Quận 1, TP.HCM");
        result.Data.Description.Should().Be("Mô tả công ty mới cập nhật.");
        result.Data.VerificationStatus.Should().Be("VERIFIED");
        result.Data.RoleInCompany.Should().Be("HR_DIRECTOR");
        result.Data.IsPrimaryContact.Should().BeTrue();

        _companyRepositoryMock.Verify(r => r.Update(existingCompany), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenTaxCodeUnchanged_ShouldNotCheckTaxCodeUniqueness()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var existingCompany = new Company
        {
            CompanyId = companyId,
            CompanyName = "Công Ty ABC",
            TaxCode = "0101234567",
            VerificationStatus = "PENDING",
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        };

        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = companyId,
            UserId = userId,
            Status = "ACTIVE",
            Company = existingCompany
        };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateCompanyProfileCommand
        {
            UserId = userId,
            CompanyName = "Công Ty ABC Đổi Tên",
            TaxCode = "0101234567"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.CompanyName.Should().Be("Công Ty ABC Đổi Tên");

        _companyRepositoryMock.Verify(r => r.ExistsByTaxCodeAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _companyRepositoryMock.Verify(r => r.Update(existingCompany), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenTaxCodeAlreadyExistsForAnotherCompany_ShouldThrowBadRequestException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var existingCompany = new Company
        {
            CompanyId = companyId,
            CompanyName = "Công Ty ABC",
            TaxCode = "0101234567",
            VerificationStatus = "PENDING"
        };

        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = companyId,
            UserId = userId,
            Status = "ACTIVE",
            Company = existingCompany
        };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        _companyRepositoryMock
            .Setup(r => r.ExistsByTaxCodeAsync("0108888888", companyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var command = new UpdateCompanyProfileCommand
        {
            UserId = userId,
            CompanyName = "Công Ty ABC",
            TaxCode = "0108888888"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Mã số thuế này đã được sử dụng bởi một công ty khác*");

        _companyRepositoryMock.Verify(r => r.Update(It.IsAny<Company>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenCompanyUserNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var command = new UpdateCompanyProfileCommand
        {
            UserId = userId,
            CompanyName = "Công Ty Bất Kỳ"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin công ty*");
    }

    [Fact]
    public async Task Handle_WhenCompanyUserHasNullCompany_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = Guid.NewGuid(),
            UserId = userId,
            Status = "ACTIVE",
            Company = null!
        };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        var command = new UpdateCompanyProfileCommand
        {
            UserId = userId,
            CompanyName = "Công Ty Bất Kỳ"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin công ty*");
    }

    [Fact]
    public async Task Handle_WhenCompanyUserStatusNotActive_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Công Ty Bị Khóa"
        };

        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            UserId = userId,
            Status = "SUSPENDED",
            Company = company
        };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        var command = new UpdateCompanyProfileCommand
        {
            UserId = userId,
            CompanyName = "Công Ty Mới"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Tài khoản doanh nghiệp của bạn đang bị khóa hoặc không hoạt động*");
    }
}
