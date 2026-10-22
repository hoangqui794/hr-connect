using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Jobs.ServiceAgreements;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

public class ServiceAgreementFlowTests
{
    private readonly Mock<IJobRepository> _jobs = new();
    private readonly Mock<IServiceAgreementRepository> _agreements = new();
    private readonly Mock<ICompanyUserRepository> _companyUsers = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IOtpService> _otpService = new();
    private readonly Mock<IAgreementPdfRenderer> _pdfRenderer = new();
    private readonly Mock<IFileStorageService> _storage = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _uow = new();

    public ServiceAgreementFlowTests()
    {
        _uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _otpService.Setup(x => x.GenerateNumericOtp(6)).Returns("123456");
        _otpService.Setup(x => x.HashOtp("123456")).Returns("HASH_123456");
        _otpService.Setup(x => x.VerifyOtp("123456", "HASH_123456")).Returns(true);
        _otpService.Setup(x => x.VerifyOtp(It.IsNotIn("123456"), "HASH_123456")).Returns(false);
        _pdfRenderer.Setup(x => x.RenderAgreementPdf(It.IsAny<ServiceAgreement>(), It.IsAny<Job>(), It.IsAny<Company>(), It.IsAny<bool>()))
            .Returns(new byte[] { 1, 2, 3, 4 });
        _storage.Setup(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("agreements/doc.pdf");
    }

    private (Job job, Company company, AppUser clientUser, CompanyUser clientMember) CreateTestJob(string serviceTypeCode)
    {
        var companyId = Guid.NewGuid();
        var company = new Company
        {
            CompanyId = companyId,
            CompanyName = "FPT Software",
            TaxCode = "0101248141",
            Address = "Khu CNC Hoa Lac, Ha Noi"
        };

        var clientUserId = Guid.NewGuid();
        var clientUser = new AppUser
        {
            UserId = clientUserId,
            Email = "ceo@fpt-software.com",
            DisplayName = "Nguyen Van CEO"
        };

        var clientMember = new CompanyUser
        {
            CompanyId = companyId,
            UserId = clientUserId,
            IsPrimaryContact = true,
            RoleInCompany = "CEO",
            Status = "ACTIVE",
            Company = company,
            User = clientUser
        };

        var jobId = Guid.NewGuid();
        var job = new Job
        {
            JobId = jobId,
            CompanyId = companyId,
            Company = company,
            CreatedBy = clientUserId,
            Title = "Senior Fullstack Engineer",
            Status = JobStatuses.PendingReview,
            ConcurrencyToken = Guid.NewGuid(),
            ProposedFeeMultiplier = 1.8m,
            ProposedWarrantyDays = 60,
            ProposedPaymentDueDays = 15,
            ProposedPricePerCv = 500_000m,
            SourcingTarget = 10,
            ReviewDays = 7,
            Quantity = 2
        };

        return (job, company, clientUser, clientMember);
    }

    [Fact]
    public async Task CreateProposal_Headhunt_ShouldCreateAgreementV1_AndChangeJobStatusToPendingAgreement()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        var internalHrId = Guid.NewGuid();

        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync("HEADHUNT_COD");
        _agreements.Setup(x => x.GetHistoryByJobIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(new List<ServiceAgreement>());

        ServiceAgreement? addedAgreement = null;
        _agreements.Setup(x => x.AddAsync(It.IsAny<ServiceAgreement>(), It.IsAny<CancellationToken>()))
            .Callback<ServiceAgreement, CancellationToken>((sa, _) => addedAgreement = sa)
            .Returns(Task.CompletedTask);

        var handler = new CreateServiceAgreementProposalCommandHandler(
            _jobs.Object, _agreements.Object, _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object);

        var command = new CreateServiceAgreementProposalCommand
        {
            JobId = job.JobId,
            UserId = internalHrId,
            ConcurrencyToken = job.ConcurrencyToken,
            FeeMultiplier = 2.0m,
            WarrantyDays = 90,
            PaymentDueDays = 20,
            AgreementNote = "Thỏa thuận VIP"
        };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Version.Should().Be(1);
        result.Status.Should().Be(ServiceAgreementStatuses.SentToClient);
        result.FeeMultiplier.Should().Be(2.0m);
        result.WarrantyDays.Should().Be(90);
        result.PaymentDueDays.Should().Be(20);
        result.VerificationCode.Should().StartWith("HRC-");

        job.Status.Should().Be(JobStatuses.PendingAgreement);
        job.CurrentServiceAgreementId.Should().Be(result.ServiceAgreementId);
        job.JobStatusHistories.Should().ContainSingle(h => h.NewStatus == JobStatuses.PendingAgreement && h.ReasonCode == JobReasonCodes.AgreementProposed);
        _agreements.Verify(x => x.AddAsync(It.IsAny<ServiceAgreement>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RespondToProposal_RequestChanges_ShouldUpdateStatusToChangeRequested()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        var agreementId = Guid.NewGuid();
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            Status = ServiceAgreementStatuses.SentToClient,
            IsCurrent = true,
            ConcurrencyToken = Guid.NewGuid(),
            CompanyNameSnapshot = company.CompanyName,
            CreatedByUserId = Guid.NewGuid()
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);

        var handler = new RespondToServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _notifications.Object, _audit.Object, _uow.Object);

        var command = new RespondToServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            UserId = clientUser.UserId,
            ConcurrencyToken = agreement.ConcurrencyToken,
            Action = ServiceAgreementResponseActions.RequestChanges,
            ChangeRequestReason = "Đề nghị giảm hệ số phí từ 2.0 xuống 1.5 tháng"
        };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Status.Should().Be(ServiceAgreementStatuses.ChangeRequested);
        result.ChangeRequestReason.Should().Be("Đề nghị giảm hệ số phí từ 2.0 xuống 1.5 tháng");
        job.JobStatusHistories.Should().Contain(h => h.ReasonCode == JobReasonCodes.AgreementChangesRequested);
    }

    [Fact]
    public async Task RespondToProposal_Accept_ShouldUpdateStatusToAccepted()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        var agreementId = Guid.NewGuid();
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            Status = ServiceAgreementStatuses.SentToClient,
            IsCurrent = true,
            ConcurrencyToken = Guid.NewGuid(),
            CompanyNameSnapshot = company.CompanyName,
            CreatedByUserId = Guid.NewGuid()
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);

        var handler = new RespondToServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _notifications.Object, _audit.Object, _uow.Object);

        var command = new RespondToServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            UserId = clientUser.UserId,
            ConcurrencyToken = agreement.ConcurrencyToken,
            Action = ServiceAgreementResponseActions.Accept
        };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Status.Should().Be(ServiceAgreementStatuses.Accepted);
        result.RespondedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SignAgreement_Headhunt_ShouldSealAgreement_AndActivateJobDirectly()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        job.Status = JobStatuses.PendingAgreement;

        var agreementId = Guid.NewGuid();
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            Status = ServiceAgreementStatuses.Accepted,
            IsCurrent = true,
            ServiceTypeCode = "HEADHUNT_COD",
            FeeMultiplier = 1.8m,
            WarrantyDays = 60,
            PaymentDueDays = 15,
            ConcurrencyToken = Guid.NewGuid(),
            CompanyNameSnapshot = company.CompanyName,
            SignerEmailSnapshot = clientUser.Email,
            VerificationCode = "HRC-123456",
            CreatedByUserId = Guid.NewGuid()
        };

        var challengeId = Guid.NewGuid();
        var challenge = new ServiceAgreementSignatureChallenge
        {
            ChallengeId = challengeId,
            ServiceAgreementId = agreementId,
            SignerUserId = clientUser.UserId,
            OtpHash = "HASH_123456",
            AttemptCount = 0,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            IsConsumed = false,
            IsRevoked = false
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _agreements.Setup(x => x.GetActiveChallengeAsync(agreementId, clientUser.UserId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(challenge);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);
        _users.Setup(x => x.GetByIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientUser);
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        var handler = new SignServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _users.Object, _otpService.Object,
            _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object);

        var command = new SignServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            Otp = "123456",
            ConsentAccepted = true,
            UserId = clientUser.UserId,
            ConcurrencyToken = agreement.ConcurrencyToken,
            ClientIp = "127.0.0.1",
            UserAgent = "TestRunner"
        };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Status.Should().Be(ServiceAgreementStatuses.Signed);
        result.SignedAt.Should().NotBeNull();
        result.HasSignedDocument.Should().BeTrue();
        challenge.IsConsumed.Should().BeTrue();

        // Job Headhunt phải chuyển thẳng sang ACTIVE
        job.Status.Should().Be(JobStatuses.Active);
        job.FeeMultiplier.Should().Be(1.8m);
        job.WarrantyDays.Should().Be(60);
        job.PaymentDueDays.Should().Be(15);
        job.AgreedAt.Should().NotBeNull();
        job.JobStatusHistories.Should().Contain(h => h.NewStatus == JobStatuses.Active && h.ReasonCode == JobReasonCodes.AgreementSigned);
    }

    [Fact]
    public async Task SignAgreement_WithInvalidOtp_ShouldIncrementAttempts_AndReject()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        var agreementId = Guid.NewGuid();
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            Status = ServiceAgreementStatuses.Accepted,
            IsCurrent = true,
            ServiceTypeCode = "HEADHUNT_COD",
            ConcurrencyToken = Guid.NewGuid()
        };

        var challengeId = Guid.NewGuid();
        var challenge = new ServiceAgreementSignatureChallenge
        {
            ChallengeId = challengeId,
            ServiceAgreementId = agreementId,
            SignerUserId = clientUser.UserId,
            OtpHash = "HASH_123456",
            AttemptCount = 0,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            IsConsumed = false
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _agreements.Setup(x => x.GetActiveChallengeAsync(agreementId, clientUser.UserId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(challenge);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);
        _users.Setup(x => x.GetByIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientUser);

        var handler = new SignServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _users.Object, _otpService.Object,
            _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object);

        var command = new SignServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            Otp = "999999", // wrong OTP
            ConsentAccepted = true,
            UserId = clientUser.UserId,
            ConcurrencyToken = agreement.ConcurrencyToken
        };

        // Act
        var act = () => handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>().WithMessage("*không chính xác*");
        challenge.AttemptCount.Should().Be(1);
        agreement.Status.Should().Be(ServiceAgreementStatuses.Accepted);
    }

    [Fact]
    public async Task VoidAgreement_WhenSigned_ShouldFailWithConflict()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        var agreementId = Guid.NewGuid();
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            Status = ServiceAgreementStatuses.Signed, // already signed
            IsCurrent = true,
            ConcurrencyToken = Guid.NewGuid()
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);

        var handler = new VoidServiceAgreementCommandHandler(
            _agreements.Object, _audit.Object, _uow.Object);

        var command = new VoidServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            UserId = Guid.NewGuid(),
            VoidReason = "Hủy thỏa thuận"
        };

        // Act
        var act = () => handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>().WithMessage("*không thể hủy bỏ*");
    }
}
