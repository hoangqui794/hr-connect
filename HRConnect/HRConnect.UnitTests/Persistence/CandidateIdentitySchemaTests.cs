using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HRConnect.UnitTests.Persistence;

public sealed class CandidateIdentitySchemaTests
{
    private static IModel GetModel()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only")
            .Options;

        using var context = new ApplicationDbContext(options);
        return context.GetService<IDesignTimeModel>().Model;
    }

    [Fact]
    public void UserEmailIdentity_HasGlobalActiveEmailAndSinglePrimaryConstraints()
    {
        var entity = GetModel().FindEntityType(typeof(UserEmailIdentity));

        entity.Should().NotBeNull();
        var indexes = entity!.GetIndexes().ToDictionary(index => index.GetDatabaseName()!);

        indexes["uq_user_email_identity_active_email"].IsUnique.Should().BeTrue();
        indexes["uq_user_email_identity_active_email"].GetFilter().Should().Be("status <> 'REVOKED'");
        indexes["uq_user_email_identity_primary_user"].IsUnique.Should().BeTrue();
        indexes["uq_user_email_identity_primary_user"].GetFilter()
            .Should().Be("kind = 'PRIMARY' AND status <> 'REVOKED'");
        entity.GetCheckConstraints().Select(item => item.Name).Should().Contain(new[]
        {
            "ck_user_email_identity_kind",
            "ck_user_email_identity_status",
            "ck_user_email_identity_verified_at",
            "ck_user_email_identity_revoked_at"
        });
    }

    [Fact]
    public void CandidateIdentityClaim_BindsTokenRequesterAndActiveTarget()
    {
        var entity = GetModel().FindEntityType(typeof(CandidateIdentityClaim));

        entity.Should().NotBeNull();
        var indexes = entity!.GetIndexes().ToDictionary(index => index.GetDatabaseName()!);

        indexes["uq_candidate_identity_claim_token_hash"].IsUnique.Should().BeTrue();
        indexes["uq_candidate_identity_claim_active_requester_email"].IsUnique.Should().BeTrue();
        indexes["uq_candidate_identity_claim_active_target"].IsUnique.Should().BeTrue();
        entity.GetForeignKeys().Should().HaveCount(4);
        entity.FindProperty(nameof(CandidateIdentityClaim.ConcurrencyToken))!.IsConcurrencyToken
            .Should().BeTrue();
    }
}
