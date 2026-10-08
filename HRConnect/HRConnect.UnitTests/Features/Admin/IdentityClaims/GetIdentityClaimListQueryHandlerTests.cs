using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.IdentityClaims.GetIdentityClaimList;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.IdentityClaims;

public sealed class GetIdentityClaimListQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsMaskedPagedReviewQueue()
    {
        var repository = new Mock<ICandidateIdentityClaimRepository>();
        var claimId = Guid.NewGuid();
        repository.Setup(x => x.GetAdminListAsync(
                "PENDING_ADMIN_REVIEW",
                "old@example.com",
                2,
                10,
                "verifiedAt",
                false,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((
                new AdminIdentityClaimListRecord[]
                {
                    new(
                        claimId,
                        Guid.NewGuid(),
                        Guid.NewGuid(),
                        Guid.NewGuid(),
                        "old@example.com",
                        "PENDING_ADMIN_REVIEW",
                        "CANDIDATE_SWAP_REQUIRES_ADMIN_REVIEW",
                        "Candidate Test",
                        "new@example.com",
                        "Candidate mới",
                        "Candidate cũ",
                        DateTime.UtcNow.AddDays(-1),
                        DateTime.UtcNow,
                        null,
                        null)
                },
                21));
        var handler = new GetIdentityClaimListQueryHandler(repository.Object);

        var response = await handler.Handle(
            new GetIdentityClaimListQuery(
                "pending_admin_review",
                " old@example.com ",
                2,
                10,
                "verifiedAt",
                "asc"),
            CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Data.Page.Should().Be(2);
        response.Data.Total.Should().Be(21);
        response.Data.TotalPages.Should().Be(3);
        response.Data.Items.Should().ContainSingle();
        response.Data.Items[0].ClaimId.Should().Be(claimId);
        response.Data.Items[0].MaskedAssertedEmail.Should().Be("ol***@example.com");
        response.Data.Items[0].RequesterPrimaryEmail.Should().Be("new@example.com");
    }

    [Theory]
    [InlineData("PENDING_VERIFICATION")]
    [InlineData("CANCELLED")]
    [InlineData("EXPIRED")]
    public void Validator_RejectsStatusesOutsideAdminReviewLifecycle(string status)
    {
        var validator = new GetIdentityClaimListQueryValidator();

        var result = validator.TestValidate(new GetIdentityClaimListQuery(Status: status));

        result.ShouldHaveValidationErrorFor(query => query.Status);
    }

    [Fact]
    public void Validator_RejectsOversizedPage()
    {
        var validator = new GetIdentityClaimListQueryValidator();

        var result = validator.TestValidate(new GetIdentityClaimListQuery(PageSize: 101));

        result.ShouldHaveValidationErrorFor(query => query.PageSize);
    }
}
