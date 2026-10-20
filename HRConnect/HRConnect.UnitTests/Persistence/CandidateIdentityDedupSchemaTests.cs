using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HRConnect.UnitTests.Persistence;

public sealed class CandidateIdentityDedupSchemaTests
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
    public void DuplicateCase_HasOrderedPairIdempotencyAndConcurrencyProtection()
    {
        var entity = GetModel().FindEntityType(typeof(CandidateDuplicateCase));

        entity.Should().NotBeNull();
        var indexes = entity!.GetIndexes().ToDictionary(index => index.GetDatabaseName()!);
        indexes["uq_candidate_duplicate_case_idempotency"].IsUnique.Should().BeTrue();
        indexes["uq_candidate_duplicate_case_active_job"].GetFilter()
            .Should().Contain("UNDER_REVIEW");
        indexes["uq_candidate_duplicate_case_active_global"].GetFilter()
            .Should().Contain("job_id IS NULL");
        entity.GetCheckConstraints().Select(item => item.Name)
            .Should().Contain("ck_candidate_duplicate_case_order");
        entity.FindProperty(nameof(CandidateDuplicateCase.ConcurrencyToken))!
            .IsConcurrencyToken.Should().BeTrue();
    }

    [Fact]
    public void SubmissionSnapshot_IsOneToOneAndIndexesOnlyMinimizedEvidence()
    {
        var entity = GetModel().FindEntityType(typeof(SubmissionIdentitySnapshot));

        entity.Should().NotBeNull();
        entity!.FindPrimaryKey()!.Properties.Should().ContainSingle()
            .Which.Name.Should().Be(nameof(SubmissionIdentitySnapshot.SubmissionId));
        entity.GetIndexes().Select(index => index.GetDatabaseName()).Should().Contain(new[]
        {
            "idx_submission_identity_email_hmac",
            "idx_submission_identity_phone_hmac",
            "idx_submission_identity_cv_sha256"
        });
        entity.FindProperty("RawCvText").Should().BeNull();
        entity.FindProperty("RawEmail").Should().BeNull();
        entity.FindProperty("RawPhone").Should().BeNull();
    }

    [Fact]
    public void MergeAttributionAndDispute_AreConcurrencyProtected()
    {
        var model = GetModel();

        model.FindEntityType(typeof(Candidate))!
            .FindProperty(nameof(Candidate.MergeConcurrencyToken))!
            .IsConcurrencyToken.Should().BeTrue();
        model.FindEntityType(typeof(Attribution))!
            .FindProperty(nameof(Attribution.ConcurrencyToken))!
            .IsConcurrencyToken.Should().BeTrue();
        model.FindEntityType(typeof(Dispute))!
            .FindProperty(nameof(Dispute.ConcurrencyToken))!
            .IsConcurrencyToken.Should().BeTrue();
    }

    [Fact]
    public void PendingSubmissionUniqueness_IsScopedPerAffiliate()
    {
        var entity = GetModel().FindEntityType(typeof(Submission))!;
        var index = entity.GetIndexes().Single(item =>
            item.GetDatabaseName() == "uq_submission_one_pending_consent");

        index.IsUnique.Should().BeTrue();
        index.Properties.Select(property => property.Name).Should().Equal(
            nameof(Submission.JobId),
            nameof(Submission.CandidateId),
            nameof(Submission.SubmittedBy));
        index.GetFilter().Should().Contain("PENDING_IDENTITY_REVIEW");
    }
}
