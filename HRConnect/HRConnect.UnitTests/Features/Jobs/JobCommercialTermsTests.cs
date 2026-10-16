using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Commands.ApproveJob;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Commands.SubmitJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Jobs.Queries.GetJobCommercialTermsDefaults;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

public class JobCommercialTermsTests
{
    private readonly Mock<IJobRepository> _jobRepository = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAdminBusinessSettings> _adminSettings = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IAuditLogService> _auditLog = new();
    private readonly Mock<ILogger<CreateJobCommandHandler>> _createJobLogger = new();

    public JobCommercialTermsTests()
    {
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
    }

    [Fact]
    public async Task CreateJob_WithProposedTerms_ShouldPersistProposedFieldsAndKeepAgreedFieldsNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var company = new Company { CompanyId = companyId, CompanyName = "Tech Corp", VerificationStatus = "VERIFIED" };
        var member = new CompanyUser { CompanyId = companyId, UserId = userId, Status = "ACTIVE", Company = company };
        _companyUserRepository.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(member);

        var serviceTypeId = Guid.NewGuid();
        _jobRepository.Setup(x => x.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync("CV_SOURCING");

        Job? capturedJob = null;
        _jobRepository.Setup(x => x.AddAsync(It.IsAny<Job>(), It.IsAny<CancellationToken>()))
            .Callback<Job, CancellationToken>((j, _) => capturedJob = j)
            .Returns(Task.CompletedTask);

        var handler = new CreateJobCommandHandler(
            _companyUserRepository.Object,
            _jobRepository.Object,
            _unitOfWork.Object,
            _createJobLogger.Object);

        var command = new CreateJobCommand
        {
            UserId = userId,
            ServiceTypeId = serviceTypeId,
            Title = "Backend Engineer",
            SourcingTarget = 5,
            ProposedTerms = new JobProposedTermsRequest(
                FeeMultiplier: null,
                WarrantyDays: null,
                PaymentDueDays: 30,
                PricePerCv: 500_000m,
                Note: "Client proposed terms note")
        };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Data.JobId.Should().NotBeEmpty();
        capturedJob.Should().NotBeNull();
        capturedJob!.ProposedPricePerCv.Should().Be(500_000m);
        capturedJob.ProposedPaymentDueDays.Should().Be(30);
        capturedJob.ProposedFeeNote.Should().Be("Client proposed terms note");

        // Agreed fields must remain null
        capturedJob.SourcingPricePerCv.Should().BeNull();
        capturedJob.FeeMultiplier.Should().BeNull();
        capturedJob.WarrantyDays.Should().BeNull();
        capturedJob.DepositPercent.Should().BeNull();
        capturedJob.ReviewDays.Should().BeNull();
        capturedJob.PaymentDueDays.Should().BeNull();
        capturedJob.AgreementReference.Should().BeNull();
        capturedJob.AgreementNote.Should().BeNull();
        capturedJob.AgreedAt.Should().BeNull();
        capturedJob.AgreedBy.Should().BeNull();
    }

    [Fact]
    public async Task SubmitJob_CvSourcing_ShouldNotAutofillAgreedPrices()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var member = new CompanyUser { CompanyId = companyId, UserId = userId, Status = "ACTIVE" };
        _companyUserRepository.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(member);

        var serviceTypeId = Guid.NewGuid();
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = companyId,
            Status = JobStatuses.Draft,
            Title = "Frontend Developer",
            Description = "React frontend developer",
            Benefits = "Insurance, laptop",
            Location = "Hanoi",
            EmploymentType = "FULL_TIME",
            Quantity = 1,
            SourcingTarget = 3,
            ProposedPricePerCv = 300_000m,
            ServiceTypeId = serviceTypeId,
            JobRequirements = [new JobRequirement { RequirementType = JobRequirementTypes.MustHave, Content = "React" }]
        };

        _jobRepository.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobRepository.Setup(x => x.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync("CV_SOURCING");

        var handler = new SubmitJobCommandHandler(
            _jobRepository.Object,
            _companyUserRepository.Object,
            _adminSettings.Object,
            _unitOfWork.Object);

        var command = new SubmitJobCommand
        {
            JobId = job.JobId,
            UserId = userId,
            ConcurrencyToken = job.ConcurrencyToken
        };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        job.Status.Should().Be(JobStatuses.PendingReview);
        // Agreed fields must remain null (no autofill)
        job.SourcingPricePerCv.Should().BeNull();
        job.FeeMultiplier.Should().BeNull();
        job.WarrantyDays.Should().BeNull();
        job.DepositPercent.Should().BeNull();
        job.ReviewDays.Should().BeNull();
    }

    [Fact]
    public async Task SubmitJob_CvSourcing_WithMissingTarget_ShouldThrowBadRequest()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var member = new CompanyUser { CompanyId = companyId, UserId = userId, Status = "ACTIVE" };
        _companyUserRepository.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(member);

        var serviceTypeId = Guid.NewGuid();
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = companyId,
            Status = JobStatuses.Draft,
            Title = "Lead Architect",
            Description = "Architecture lead",
            Benefits = "Great salary",
            Location = "HCMC",
            EmploymentType = "FULL_TIME",
            Quantity = 1,
            SourcingTarget = null, // Invalid for CV_SOURCING
            ServiceTypeId = serviceTypeId,
            JobRequirements = [new JobRequirement { RequirementType = JobRequirementTypes.MustHave, Content = "Arch" }]
        };

        _jobRepository.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobRepository.Setup(x => x.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync("CV_SOURCING");

        var handler = new SubmitJobCommandHandler(
            _jobRepository.Object,
            _companyUserRepository.Object,
            _adminSettings.Object,
            _unitOfWork.Object);

        var command = new SubmitJobCommand
        {
            JobId = job.JobId,
            UserId = userId,
            ConcurrencyToken = job.ConcurrencyToken
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(command, CancellationToken.None));
        ex.ErrorCode.Should().Be("INVALID_SOURCING_TARGET");
    }

    [Fact]
    public async Task GetCommercialTermsDefaults_ShouldReturnProposedAndSystemDefaults()
    {
        // Arrange
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.PendingReview,
            ServiceType = new ServiceType { Code = "CV_SOURCING", Name = "CV Sourcing" },
            ProposedPricePerCv = 400_000m,
            ProposedFeeNote = "Prefer lower price"
        };
        _jobRepository.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, It.IsAny<CancellationToken>())).ReturnsAsync(500_000m);
        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, It.IsAny<CancellationToken>())).ReturnsAsync(30m);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, It.IsAny<CancellationToken>())).ReturnsAsync(7);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, It.IsAny<CancellationToken>())).ReturnsAsync(5);

        var handler = new GetJobCommercialTermsDefaultsQueryHandler(_jobRepository.Object, _adminSettings.Object);

        // Act
        var result = await handler.Handle(new GetJobCommercialTermsDefaultsQuery(job.JobId), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        var json = JsonSerializer.Serialize(result.Data);
        json.Should().Contain("\"serviceTypeCode\":\"CV_SOURCING\"");
        json.Should().Contain("400000"); // Proposed & prefill price
        json.Should().Contain("Prefer lower price");
    }

    [Fact]
    public async Task ApproveJob_CvSourcing_WithValidTerms_ShouldSaveAgreedCommercialTermsAndLogAudit()
    {
        // Arrange
        var hrUserId = Guid.NewGuid();
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.PendingReview,
            Title = "Senior QA",
            CurrencyCode = "VND",
            SourcingTarget = 2,
            ServiceType = new ServiceType { Code = "CV_SOURCING", Name = "CV Sourcing" },
            Company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Tech Corp" }
        };
        _jobRepository.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, It.IsAny<CancellationToken>())).ReturnsAsync(500_000m);
        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, It.IsAny<CancellationToken>())).ReturnsAsync(30m);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, It.IsAny<CancellationToken>())).ReturnsAsync(7);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, It.IsAny<CancellationToken>())).ReturnsAsync(5);

        var handler = new ApproveJobCommandHandler(_jobRepository.Object, _adminSettings.Object, _notifications.Object, _auditLog.Object, _unitOfWork.Object);

        var command = new ApproveJobCommand
        {
            JobId = job.JobId,
            UserId = hrUserId,
            ConcurrencyToken = job.ConcurrencyToken,
            AgreementReference = "HD-2026-QA-01",
            Note = "Agreed via client conference call",
            CommercialTerms = new CommercialTermsApprovalRequest(
                PricePerCv: 450_000m,
                SourcingTarget: 2,
                DepositPercent: 30m,
                ReviewDays: 5,
                PaymentDueDays: 7)
        };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        job.Status.Should().Be(JobStatuses.Active);
        job.SourcingPricePerCv.Should().Be(450_000m);
        job.DepositPercent.Should().Be(30m);
        job.ReviewDays.Should().Be(5);
        job.PaymentDueDays.Should().Be(7);
        job.AgreementReference.Should().Be("HD-2026-QA-01");
        job.AgreementNote.Should().Be("Agreed via client conference call");
        job.AgreedBy.Should().Be(hrUserId);
        job.AgreedAt.Should().NotBeNull();

        _auditLog.Verify(x => x.AddAsync(
            It.Is<AuditEntry>(e => e.Action == AuditActions.JobApproved && e.ActorUserId == hrUserId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApproveJob_CvSourcing_DiffersFromProposed_MissingAgreementReference_ShouldThrowBadRequest()
    {
        // Arrange
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.PendingReview,
            ProposedPricePerCv = 400_000m, // Client proposed 400k
            ServiceType = new ServiceType { Code = "CV_SOURCING", Name = "CV Sourcing" }
        };
        _jobRepository.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, It.IsAny<CancellationToken>())).ReturnsAsync(500_000m);
        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, It.IsAny<CancellationToken>())).ReturnsAsync(30m);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, It.IsAny<CancellationToken>())).ReturnsAsync(7);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, It.IsAny<CancellationToken>())).ReturnsAsync(5);

        var handler = new ApproveJobCommandHandler(_jobRepository.Object, _adminSettings.Object, _notifications.Object, _auditLog.Object, _unitOfWork.Object);

        var command = new ApproveJobCommand
        {
            JobId = job.JobId,
            UserId = Guid.NewGuid(),
            ConcurrencyToken = job.ConcurrencyToken,
            AgreementReference = "", // Missing reference while price differs (500k vs 400k)!
            CommercialTerms = new CommercialTermsApprovalRequest(
                PricePerCv: 500_000m,
                DepositPercent: 30m,
                ReviewDays: 5)
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(command, CancellationToken.None));
        ex.ErrorCode.Should().Be("AGREEMENT_REFERENCE_REQUIRED");
    }

    [Fact]
    public async Task ApproveJob_CvSourcing_OutOfRangeDeposit_ShouldThrowBadRequest()
    {
        // Arrange
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.PendingReview,
            ServiceType = new ServiceType { Code = "CV_SOURCING", Name = "CV Sourcing" }
        };
        _jobRepository.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        var handler = new ApproveJobCommandHandler(_jobRepository.Object, _adminSettings.Object, _notifications.Object, _auditLog.Object, _unitOfWork.Object);

        var command = new ApproveJobCommand
        {
            JobId = job.JobId,
            UserId = Guid.NewGuid(),
            ConcurrencyToken = job.ConcurrencyToken,
            AgreementReference = "REF-123",
            CommercialTerms = new CommercialTermsApprovalRequest(
                PricePerCv: 500_000m,
                DepositPercent: 120m, // Invalid: > 100
                ReviewDays: 5)
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(command, CancellationToken.None));
        ex.ErrorCode.Should().Be("TERM_OUT_OF_RANGE");
    }

    [Fact]
    public async Task ApproveJob_CvApplication_WithSourcingTerms_ShouldThrowTermNotApplicable()
    {
        // Arrange
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.PendingReview,
            ServiceType = new ServiceType { Code = "CV_APPLICATION", Name = "CV Application" }
        };
        _jobRepository.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        var handler = new ApproveJobCommandHandler(_jobRepository.Object, _adminSettings.Object, _notifications.Object, _auditLog.Object, _unitOfWork.Object);

        var command = new ApproveJobCommand
        {
            JobId = job.JobId,
            UserId = Guid.NewGuid(),
            ConcurrencyToken = job.ConcurrencyToken,
            AgreementReference = "REF-APP",
            CommercialTerms = new CommercialTermsApprovalRequest(
                PricePerCv: 500_000m) // Invalid for CV_APPLICATION!
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(command, CancellationToken.None));
        ex.ErrorCode.Should().Be("TERM_NOT_APPLICABLE");
    }

    [Fact]
    public void JobDto_ShouldMaskAgreementDetails_WhenNotReviewer()
    {
        // Arrange
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = Guid.NewGuid(),
            Title = "Senior Dev",
            CurrencyCode = "VND",
            Status = JobStatuses.Active,
            SourcingPricePerCv = 400_000m,
            DepositPercent = 25m,
            ReviewDays = 3,
            AgreementReference = "SECRET_REF_INTERNAL",
            AgreementNote = "Internal discount approved by Director",
            AgreedAt = DateTime.UtcNow,
            AgreedByNavigation = new AppUser { DisplayName = "Internal HR Staff" }
        };

        // Act - for client (isReviewer = false)
        var clientDto = JobDto.From(job, isReviewer: false);

        // Act - for HR reviewer (isReviewer = true)
        var reviewerDto = JobDto.From(job, isReviewer: true);

        // Assert
        clientDto.CommercialTerms.Should().NotBeNull();
        clientDto.CommercialTerms!.PricePerCv.Should().Be(400_000m);
        clientDto.CommercialTerms.DepositPercent.Should().Be(25m);
        clientDto.CommercialTerms.AgreementReference.Should().BeNull("Client should NOT see internal agreement reference");
        clientDto.CommercialTerms.AgreementNote.Should().BeNull("Client should NOT see internal agreement note");

        reviewerDto.CommercialTerms.Should().NotBeNull();
        reviewerDto.CommercialTerms!.AgreementReference.Should().Be("SECRET_REF_INTERNAL");
        reviewerDto.CommercialTerms.AgreementNote.Should().Be("Internal discount approved by Director");
        reviewerDto.CommercialTerms.AgreedBy.Should().Be("Internal HR Staff");
    }
}
