using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CandidateDuplicates.Queries;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CandidateDuplicates;

public sealed class CandidateDuplicateCaseQueryHandlerTests
{
    [Fact]
    public async Task List_MasksContactAndReturnsPagination()
    {
        var repository = new Mock<ICandidateDuplicateRepository>();
        var duplicateCase = CreateCase();
        repository.Setup(x => x.GetReviewPageAsync(
                "AWAITING_CANDIDATE",
                "HIGH",
                duplicateCase.JobId,
                duplicateCase.Job!.CompanyId,
                null,
                null,
                "candidate",
                20,
                20,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((new[] { duplicateCase }, 41));
        var handler = new GetCandidateDuplicateCasesQueryHandler(repository.Object);

        var response = await handler.Handle(new GetCandidateDuplicateCasesQuery(
            "awaiting_candidate",
            "high",
            duplicateCase.JobId,
            duplicateCase.Job!.CompanyId,
            null,
            null,
            "candidate",
            2,
            20), CancellationToken.None);

        response.TotalCount.Should().Be(41);
        response.TotalPages.Should().Be(3);
        response.Items.Should().ContainSingle();
        new[] { response.Items[0].CandidateA.MaskedEmail, response.Items[0].CandidateB.MaskedEmail }
            .Should().BeEquivalentTo("ca***@example.com", "ot***@example.com");
        new[] { response.Items[0].CandidateA.MaskedPhone, response.Items[0].CandidateB.MaskedPhone }
            .Should().BeEquivalentTo("***5678", "***4321");
    }

    [Fact]
    public async Task Detail_ReturnsSignalsAndRelatedBusinessStateWithoutRawContact()
    {
        var repository = new Mock<ICandidateDuplicateRepository>();
        var duplicateCase = CreateCase();
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = duplicateCase.CandidateAId,
            JobId = duplicateCase.JobId!.Value,
            CvId = Guid.NewGuid(),
            SubmittedBy = Guid.NewGuid(),
            Source = "AFFILIATE",
            Status = "PENDING_IDENTITY_REVIEW",
            SubmittedAt = DateTime.UtcNow,
            Consent = new SubmissionConsent { Status = "CONFIRMED", RespondedAt = DateTime.UtcNow }
        };
        repository.Setup(x => x.GetByIdForReviewAsync(
                duplicateCase.DuplicateCaseId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(duplicateCase);
        repository.Setup(x => x.GetRelatedSubmissionsAsync(
                duplicateCase.CandidateAId,
                duplicateCase.CandidateBId,
                duplicateCase.JobId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { submission });
        var handler = new GetCandidateDuplicateCaseDetailQueryHandler(repository.Object);

        var response = await handler.Handle(
            new GetCandidateDuplicateCaseDetailQuery(duplicateCase.DuplicateCaseId),
            CancellationToken.None);

        response.Signals.Should().ContainSingle(signal =>
            signal.ReasonCode == "EXACT_CV_AND_NORMALIZED_NAME" && signal.Score == 1m);
        response.Submissions.Should().ContainSingle(item =>
            item.Status == "PENDING_IDENTITY_REVIEW" && item.ConsentStatus == "CONFIRMED");
        response.CandidateA.MaskedEmail.Should().Contain("***");
        response.CandidateA.MaskedPhone.Should().StartWith("***");
    }

    [Fact]
    public async Task Detail_WhenCaseDoesNotExist_ThrowsNotFound()
    {
        var repository = new Mock<ICandidateDuplicateRepository>();
        repository.Setup(x => x.GetByIdForReviewAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateDuplicateCase?)null);
        var handler = new GetCandidateDuplicateCaseDetailQueryHandler(repository.Object);

        var action = () => handler.Handle(
            new GetCandidateDuplicateCaseDetailQuery(Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public void Validator_RejectsUnknownLifecycleAndOversizedPage()
    {
        var validator = new GetCandidateDuplicateCasesQueryValidator();

        var result = validator.TestValidate(new GetCandidateDuplicateCasesQuery(
            "AUTO_MERGED", "CERTAIN", null, null, null, null, null, 0, 101));

        result.ShouldHaveValidationErrorFor(query => query.Status);
        result.ShouldHaveValidationErrorFor(query => query.RiskLevel);
        result.ShouldHaveValidationErrorFor(query => query.Page);
        result.ShouldHaveValidationErrorFor(query => query.PageSize);
    }

    private static CandidateDuplicateCase CreateCase()
    {
        var company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Example Co" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            Company = company,
            Title = "Backend Developer",
            Status = "ACTIVE"
        };
        var candidateA = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Candidate A",
            Email = "candidate@example.com",
            Phone = "090012345678",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        var candidateB = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Candidate B",
            Email = "other@example.com",
            Phone = "091187654321",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };
        var ordered = string.CompareOrdinal(candidateA.CandidateId.ToString("N"), candidateB.CandidateId.ToString("N")) <= 0
            ? (candidateA, candidateB)
            : (candidateB, candidateA);
        var duplicateCase = new CandidateDuplicateCase
        {
            DuplicateCaseId = Guid.NewGuid(),
            CandidateAId = ordered.Item1.CandidateId,
            CandidateA = ordered.Item1,
            CandidateBId = ordered.Item2.CandidateId,
            CandidateB = ordered.Item2,
            JobId = job.JobId,
            Job = job,
            Status = "AWAITING_CANDIDATE",
            RiskLevel = "HIGH",
            ConcurrencyToken = Guid.NewGuid(),
            IdempotencyKey = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        duplicateCase.Signals.Add(new CandidateDuplicateSignal
        {
            DuplicateSignalId = Guid.NewGuid(),
            DuplicateCaseId = duplicateCase.DuplicateCaseId,
            ReasonCode = "EXACT_CV_AND_NORMALIZED_NAME",
            DetectorVersion = "sync-v1",
            Score = 1m,
            Evidence = "{\"cv\":\"exact-binary-sha256\"}",
            CreatedAt = DateTime.UtcNow
        });
        return duplicateCase;
    }
}
