using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Companies.Commands.DeleteCompanyLogo;
using HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Companies;

public sealed class CompanyLogoCommandHandlerTests
{
    private readonly Mock<ICompanyUserRepository> _companyUsers = new();
    private readonly Mock<ICompanyRepository> _companies = new();
    private readonly Mock<IStorageCleanupJobRepository> _cleanup = new();
    private readonly Mock<IFileStorageService> _storage = new();
    private readonly Mock<IAvatarImageProcessor> _processor = new();
    private readonly Mock<ICompanyLogoUrlResolver> _resolver = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    public CompanyLogoCommandHandlerTests()
    {
        _processor.Setup(x => x.ProcessAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ProcessedAvatarImage([1, 2, 3], "image/webp", ".webp", 400, 400));
        _storage.Setup(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "image/webp", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Stream _, string key, string _, CancellationToken _) => key);
        _resolver.Setup(x => x.Resolve(It.IsAny<Company>()))
            .Returns((Company company) => $"/api/v1/companies/{company.CompanyId:D}/logo?v={company.LogoUpdatedAt!.Value.Ticks}");
    }

    [Fact]
    public async Task Upload_ValidReplacement_CommitsNewKeyAndQueuesOldLogo()
    {
        var membership = ActiveMembership();
        membership.Company.LogoObjectKey = $"company-logos/{membership.CompanyId:D}/old.webp";
        _companyUsers.Setup(x => x.GetByUserIdAsync(membership.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(membership);
        var handler = UploadHandler();

        var result = await handler.Handle(UploadCommand(membership.UserId), CancellationToken.None);

        result.Data!.LogoUrl.Should().StartWith($"/api/v1/companies/{membership.CompanyId:D}/logo?v=");
        membership.Company.LogoObjectKey.Should().StartWith($"company-logos/{membership.CompanyId:D}/").And.EndWith(".webp");
        membership.Company.LogoUrl.Should().BeNull();
        _cleanup.Verify(x => x.AddAsync(It.Is<StorageCleanupJob>(job =>
            job.ObjectKey.EndsWith("old.webp") && job.Reason == "COMPANY_LOGO_REPLACED"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Upload_DatabaseCommitFails_DeletesNewObjectAsCompensation()
    {
        var membership = ActiveMembership();
        _companyUsers.Setup(x => x.GetByUserIdAsync(membership.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(membership);
        _unitOfWork.Setup(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("database unavailable"));

        var action = () => UploadHandler().Handle(UploadCommand(membership.UserId), CancellationToken.None);

        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("database unavailable");
        _storage.Verify(x => x.DeleteAsync(It.Is<string>(key => key.StartsWith($"company-logos/{membership.CompanyId:D}/")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Upload_InactiveMembership_StopsBeforeImageProcessing()
    {
        var membership = ActiveMembership();
        membership.Status = "SUSPENDED";
        _companyUsers.Setup(x => x.GetByUserIdAsync(membership.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(membership);

        var action = () => UploadHandler().Handle(UploadCommand(membership.UserId), CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        _processor.Verify(x => x.ProcessAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Delete_ExistingLogo_ClearsPointerAndQueuesCleanup()
    {
        var membership = ActiveMembership();
        var oldKey = $"company-logos/{membership.CompanyId:D}/old.webp";
        membership.Company.LogoObjectKey = oldKey;
        _companyUsers.Setup(x => x.GetByUserIdAsync(membership.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(membership);
        var handler = new DeleteCompanyLogoCommandHandler(_companyUsers.Object, _companies.Object, _cleanup.Object,
            _unitOfWork.Object, Mock.Of<ILogger<DeleteCompanyLogoCommandHandler>>());

        var result = await handler.Handle(new DeleteCompanyLogoCommand { UserId = membership.UserId }, CancellationToken.None);

        result.Data!.LogoUrl.Should().BeNull();
        membership.Company.LogoObjectKey.Should().BeNull();
        _cleanup.Verify(x => x.AddAsync(It.Is<StorageCleanupJob>(job =>
            job.ObjectKey == oldKey && job.Reason == "COMPANY_LOGO_DELETED"), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private UploadCompanyLogoCommandHandler UploadHandler() => new(
        _companyUsers.Object, _companies.Object, _cleanup.Object, _storage.Object, _processor.Object,
        _resolver.Object, _unitOfWork.Object, Mock.Of<ILogger<UploadCompanyLogoCommandHandler>>());

    private static CompanyUser ActiveMembership()
    {
        var company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "ACME", VerificationStatus = "VERIFIED" };
        return new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(), CompanyId = company.CompanyId, UserId = Guid.NewGuid(),
            Status = "ACTIVE", Company = company
        };
    }

    private static UploadCompanyLogoCommand UploadCommand(Guid userId) => new()
    {
        UserId = userId, FileName = "logo.png", ContentType = "image/png", FileSizeBytes = 3,
        FileStream = new MemoryStream([1, 2, 3])
    };
}
