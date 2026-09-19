using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Admin.Approvals.ApproveAffiliate;
using HRConnect.Application.Features.Admin.Approvals.RejectAffiliate;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin.Approvals;

public class ApproveRejectAffiliateCommandHandlerTests
{
    private readonly Mock<IAdminApprovalService> _approvalServiceMock;

    public ApproveRejectAffiliateCommandHandlerTests()
    {
        _approvalServiceMock = new Mock<IAdminApprovalService>();
    }

    [Fact]
    public async Task ApproveAffiliate_ShouldCallService_AndReturnSuccess()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var command = new ApproveAffiliateCommand(appId, "Approved by QA", adminId);
        var handler = new ApproveAffiliateCommandHandler(_approvalServiceMock.Object);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("approved successfully");

        _approvalServiceMock.Verify(s => s.ApproveAffiliateApplicationAsync(
            appId,
            adminId,
            "Approved by QA",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RejectAffiliate_ShouldCallService_AndReturnSuccess()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var command = new RejectAffiliateCommand(appId, "Invalid documents", adminId);
        var handler = new RejectAffiliateCommandHandler(_approvalServiceMock.Object);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("rejected successfully");

        _approvalServiceMock.Verify(s => s.RejectAffiliateApplicationAsync(
            appId,
            adminId,
            "Invalid documents",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void RejectAffiliateValidator_ShouldFail_WhenReasonIsEmpty()
    {
        // Arrange
        var validator = new RejectAffiliateCommandValidator();
        var command = new RejectAffiliateCommand(Guid.NewGuid(), "");

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Reason);
    }

    [Fact]
    public void RejectAffiliateValidator_ShouldFail_WhenReasonExceedsMaxLength()
    {
        // Arrange
        var validator = new RejectAffiliateCommandValidator();
        var command = new RejectAffiliateCommand(Guid.NewGuid(), new string('A', 501));

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Reason);
    }
}
