using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Admin.Approvals.ApproveCompany;
using HRConnect.Application.Features.Admin.Approvals.RejectCompany;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin.Approvals;

public class ApproveRejectCompanyCommandHandlerTests
{
    private readonly Mock<IAdminApprovalService> _approvalServiceMock;

    public ApproveRejectCompanyCommandHandlerTests()
    {
        _approvalServiceMock = new Mock<IAdminApprovalService>();
    }

    [Fact]
    public async Task ApproveCompany_ShouldCallService_AndReturnSuccess()
    {
        // Arrange
        var reqId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var command = new ApproveCompanyCommand(reqId, "Company verified", adminId);
        var handler = new ApproveCompanyCommandHandler(_approvalServiceMock.Object);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("approved successfully");

        _approvalServiceMock.Verify(s => s.ApproveCompanyVerificationRequestAsync(
            reqId,
            adminId,
            "Company verified",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RejectCompany_ShouldCallService_AndReturnSuccess()
    {
        // Arrange
        var reqId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var command = new RejectCompanyCommand(reqId, "Invalid tax code", adminId);
        var handler = new RejectCompanyCommandHandler(_approvalServiceMock.Object);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("rejected successfully");

        _approvalServiceMock.Verify(s => s.RejectCompanyVerificationRequestAsync(
            reqId,
            adminId,
            "Invalid tax code",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void RejectCompanyValidator_ShouldFail_WhenReasonIsEmpty()
    {
        // Arrange
        var validator = new RejectCompanyCommandValidator();
        var command = new RejectCompanyCommand(Guid.NewGuid(), "");

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Reason);
    }

    [Fact]
    public void RejectCompanyValidator_ShouldFail_WhenReasonExceedsMaxLength()
    {
        // Arrange
        var validator = new RejectCompanyCommandValidator();
        var command = new RejectCompanyCommand(Guid.NewGuid(), new string('C', 501));

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Reason);
    }
}
