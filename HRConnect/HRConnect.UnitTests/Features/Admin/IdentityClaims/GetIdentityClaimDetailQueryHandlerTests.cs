using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.IdentityClaims.GetIdentityClaimDetail;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.IdentityClaims;

public sealed class GetIdentityClaimDetailQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsEvidenceForBothCandidatesAndCurrentEmailOwner()
    {
        var repository = new Mock<ICandidateIdentityClaimRepository>();
        var duplicates = new Mock<ICandidateDuplicateRepository>();
        var claimId = Guid.NewGuid();
        var duplicateCaseId = Guid.NewGuid();
        var requester = CandidateRecord(cvCount: 0, submissionCount: 0, applicationCount: 0);
        var target = CandidateRecord(cvCount: 2, submissionCount: 3, applicationCount: 1);
        var owner = new AdminIdentityClaimEmailOwnerRecord(
            Guid.NewGuid(), Guid.NewGuid(), "owner@example.com", "Current Owner", "ALIAS", "VERIFIED");
        repository.Setup(x => x.GetAdminDetailAsync(claimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AdminIdentityClaimDetailRecord(
                claimId,
                Guid.NewGuid(),
                "Requester",
                "new@example.com",
                "ACTIVE",
                "old@example.com",
                "old@example.com",
                "PENDING_ADMIN_REVIEW",
                "EMAIL_IDENTITY_OWNERSHIP_CONFLICT",
                DateTime.UtcNow.AddMinutes(5),
                1,
                2,
                DateTime.UtcNow,
                DateTime.UtcNow,
                null,
                null,
                null,
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow,
                Guid.NewGuid(),
                false,
                false,
                requester,
                target,
                owner));
        duplicates.Setup(x => x.FindIdentityClaimCaseIdAsync(
                requester.CandidateId, target.CandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(duplicateCaseId);
        var handler = new GetIdentityClaimDetailQueryHandler(repository.Object, duplicates.Object);

        var response = await handler.Handle(
            new GetIdentityClaimDetailQuery(claimId), CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Data.AssertedEmail.Should().Be("old@example.com");
        response.Data.RequesterCandidate.HasBusinessData.Should().BeFalse();
        response.Data.TargetCandidate!.HasBusinessData.Should().BeTrue();
        response.Data.CurrentEmailOwner!.UserId.Should().Be(owner.UserId);
        response.Data.DuplicateCaseId.Should().Be(duplicateCaseId);
        response.Data.Evidence.EmailOwnershipVerified.Should().BeTrue();
        response.Data.Evidence.SamePhone.Should().BeTrue();
        response.Data.ConcurrencyToken.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Handle_WhenClaimDoesNotExist_ReturnsControlledNotFound()
    {
        var repository = new Mock<ICandidateIdentityClaimRepository>();
        var duplicates = new Mock<ICandidateDuplicateRepository>();
        var handler = new GetIdentityClaimDetailQueryHandler(repository.Object, duplicates.Object);

        var action = () => handler.Handle(
            new GetIdentityClaimDetailQuery(Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Không tìm thấy yêu cầu liên kết danh tính Candidate.");
    }

    private static AdminIdentityClaimCandidateRecord CandidateRecord(
        int cvCount,
        int submissionCount,
        int applicationCount) =>
        new(
            Guid.NewGuid(),
            null,
            "Candidate",
            "candidate@example.com",
            "0900000000",
            "0900000000",
            "ACTIVE",
            null,
            cvCount,
            submissionCount,
            applicationCount,
            0,
            0,
            "Đại học",
            3,
            "Backend Developer",
            "Tóm tắt hồ sơ",
            new DateOnly(2000, 1, 1),
            DateTime.UtcNow.AddYears(-1),
            DateTime.UtcNow,
            cvCount > 0 ? Guid.NewGuid() : null,
            "CV chính",
            "cv.pdf",
            null,
            null);
}
