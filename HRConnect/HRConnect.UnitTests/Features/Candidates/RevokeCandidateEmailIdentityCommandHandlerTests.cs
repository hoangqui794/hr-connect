using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Identity.RevokeCandidateEmailIdentity;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class RevokeCandidateEmailIdentityCommandHandlerTests
{
    [Fact]
    public async Task Handle_RevokesVerifiedAliasAndWritesMaskedAudit()
    {
        var userId = Guid.NewGuid();
        var identityId = Guid.NewGuid();
        var token = Guid.NewGuid();
        var candidates = new Mock<ICandidateRepository>();
        var identities = new Mock<IUserEmailIdentityRepository>();
        var audit = new Mock<IAuditLogService>();
        var unit = new Mock<IUnitOfWork>();
        candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" });
        var identity = new UserEmailIdentity
        {
            EmailIdentityId = identityId, UserId = userId, Email = "old@example.com",
            NormalizedEmail = "old@example.com", Kind = "ALIAS", Status = "VERIFIED", ConcurrencyToken = token
        };
        identities.Setup(x => x.GetByIdAndUserIdAsync(identityId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(identity);
        AuditEntry? captured = null;
        audit.Setup(x => x.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
            .Callback<AuditEntry, CancellationToken>((entry, _) => captured = entry);

        var handler = new RevokeCandidateEmailIdentityCommandHandler(
            candidates.Object, identities.Object, audit.Object, unit.Object);
        var response = await handler.Handle(new(userId, identityId, token), CancellationToken.None);

        response.Status.Should().Be("REVOKED");
        identity.RevokedAt.Should().NotBeNull();
        captured!.Action.Should().Be(AuditActions.CandidateEmailIdentityRevoked);
        captured.NewValues!.ToString().Should().NotContain("old@example.com");
        unit.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_RejectsPrimaryIdentity()
    {
        var userId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var candidates = new Mock<ICandidateRepository>();
        var identities = new Mock<IUserEmailIdentityRepository>();
        candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" });
        identities.Setup(x => x.GetByIdAndUserIdAsync(id, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity { EmailIdentityId = id, UserId = userId, Kind = "PRIMARY", Status = "VERIFIED" });
        var handler = new RevokeCandidateEmailIdentityCommandHandler(
            candidates.Object, identities.Object, Mock.Of<IAuditLogService>(), Mock.Of<IUnitOfWork>());

        Func<Task> action = () => handler.Handle(new(userId, id, Guid.NewGuid()), CancellationToken.None);
        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("PRIMARY_EMAIL_CANNOT_BE_REVOKED");
    }

    [Fact]
    public async Task Handle_ReleasesSwappedCandidateAndRestoresArchivedPlaceholder_WhenRevokingSwappedAlias()
    {
        var userId = Guid.NewGuid();
        var identityId = Guid.NewGuid();
        var token = Guid.NewGuid();
        var candidates = new Mock<ICandidateRepository>();
        var identities = new Mock<IUserEmailIdentityRepository>();
        var audit = new Mock<IAuditLogService>();
        var unit = new Mock<IUnitOfWork>();

        var swappedCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            NormalizedEmail = "aff@example.com",
            Status = "ACTIVE"
        };
        var archivedPlaceholder = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = null,
            NormalizedEmail = "primary@example.com",
            Status = "ARCHIVED",
            MergedIntoCandidateId = swappedCandidate.CandidateId
        };

        candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(swappedCandidate);
        candidates.Setup(x => x.GetArchivedMergedSourceAsync(swappedCandidate.CandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(archivedPlaceholder);

        var identity = new UserEmailIdentity
        {
            EmailIdentityId = identityId,
            UserId = userId,
            Email = "aff@example.com",
            NormalizedEmail = "aff@example.com",
            Kind = "ALIAS",
            Status = "VERIFIED",
            ConcurrencyToken = token
        };
        identities.Setup(x => x.GetByIdAndUserIdAsync(identityId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(identity);

        var handler = new RevokeCandidateEmailIdentityCommandHandler(
            candidates.Object, identities.Object, audit.Object, unit.Object);

        var response = await handler.Handle(new(userId, identityId, token), CancellationToken.None);

        response.Status.Should().Be("REVOKED");
        swappedCandidate.UserId.Should().BeNull();
        archivedPlaceholder.Status.Should().Be("ACTIVE");
        archivedPlaceholder.MergedIntoCandidateId.Should().BeNull();
        archivedPlaceholder.UserId.Should().Be(userId);
        candidates.Verify(x => x.Update(swappedCandidate), Times.Once);
        candidates.Verify(x => x.Update(archivedPlaceholder), Times.Once);
        unit.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReleasesSwappedCandidateAndCreatesFallbackCandidate_WhenNoArchivedPlaceholderExists()
    {
        var userId = Guid.NewGuid();
        var identityId = Guid.NewGuid();
        var token = Guid.NewGuid();
        var candidates = new Mock<ICandidateRepository>();
        var identities = new Mock<IUserEmailIdentityRepository>();
        var audit = new Mock<IAuditLogService>();
        var unit = new Mock<IUnitOfWork>();
        var users = new Mock<IUserRepository>();
        var emailNormalizer = new Mock<IEmailNormalizer>();

        var swappedCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            NormalizedEmail = "aff@example.com",
            Status = "ACTIVE"
        };

        candidates.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(swappedCandidate);
        candidates.Setup(x => x.GetArchivedMergedSourceAsync(swappedCandidate.CandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        users.Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser
            {
                UserId = userId,
                Email = "owner@example.com",
                DisplayName = "Khúc Ngọc Sơn"
            });
        emailNormalizer.Setup(x => x.Normalize("owner@example.com")).Returns("owner@example.com");

        var identity = new UserEmailIdentity
        {
            EmailIdentityId = identityId,
            UserId = userId,
            Email = "aff@example.com",
            NormalizedEmail = "aff@example.com",
            Kind = "ALIAS",
            Status = "VERIFIED",
            ConcurrencyToken = token
        };
        identities.Setup(x => x.GetByIdAndUserIdAsync(identityId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(identity);

        var handler = new RevokeCandidateEmailIdentityCommandHandler(
            candidates.Object, identities.Object, audit.Object, unit.Object, users.Object, emailNormalizer.Object);

        await handler.Handle(new(userId, identityId, token), CancellationToken.None);

        swappedCandidate.UserId.Should().BeNull();
        candidates.Verify(x => x.AddAsync(
            It.Is<Candidate>(c =>
                c.UserId == userId &&
                c.Status == "ACTIVE" &&
                c.NormalizedEmail == "owner@example.com" &&
                c.FullName == "Khúc Ngọc Sơn"),
            It.IsAny<CancellationToken>()), Times.Once);
        unit.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
