using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
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

    [Fact]
    public async Task CreateSignatureChallenge_WhenNotDevelopment_ShouldHideDevOtp_AndFailWhenEmailFails()
    {
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
            CompanyNameSnapshot = company.CompanyName,
            ConcurrencyToken = Guid.NewGuid()
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);
        _users.Setup(x => x.GetByIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientUser);
        _agreements.Setup(x => x.GetChallengeCountTodayAsync(clientUser.UserId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);
        _agreements.Setup(x => x.GetActiveChallengeAsync(agreementId, clientUser.UserId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync((ServiceAgreementSignatureChallenge?)null);

        var email = new Mock<IEmailService>();
        var handler = new CreateSignatureChallengeCommandHandler(
            _agreements.Object, _companyUsers.Object, _users.Object, _otpService.Object, email.Object, _uow.Object);

        // Non-dev + email succeeds -> DevOtp must be null
        email.Setup(x => x.SendEmailAsync(clientUser.Email!, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailResult { IsSuccess = true, MessageId = "ok" });

        var prodResponse = await handler.Handle(new CreateSignatureChallengeCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            UserId = clientUser.UserId,
            IncludeDevOtp = false
        }, CancellationToken.None);

        prodResponse.DevOtp.Should().BeNull();
        prodResponse.Message.Should().NotContain("123456");

        // Non-dev + email fails -> throw BadRequestException without saving or returning OTP
        agreement.Status = ServiceAgreementStatuses.Accepted;
        email.Setup(x => x.SendEmailAsync(clientUser.Email!, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailResult { IsSuccess = false, ErrorMessage = "Invalid Resend key" });

        var act = () => handler.Handle(new CreateSignatureChallengeCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            UserId = clientUser.UserId,
            IncludeDevOtp = false
        }, CancellationToken.None);

        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode.Should().Be("SIGNATURE_OTP_EMAIL_FAILED");
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PrivateAgreementQueries_ShouldRejectNonMemberClient_AndAllowOwnerOrBackoffice()
    {
        var (job, company, ownerUser, ownerMember) = CreateTestJob("HEADHUNT_COD");
        var outsiderUserId = Guid.NewGuid();
        var outsiderMember = new CompanyUser
        {
            CompanyId = Guid.NewGuid(),
            UserId = outsiderUserId,
            Status = "ACTIVE"
        };
        var agreementId = Guid.NewGuid();
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            Status = ServiceAgreementStatuses.SentToClient,
            IsCurrent = true,
            ServiceTypeCode = "HEADHUNT_COD",
            CompanyNameSnapshot = company.CompanyName
        };

        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _agreements.Setup(x => x.GetCurrentByJobIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _agreements.Setup(x => x.GetHistoryByJobIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(new List<ServiceAgreement> { agreement });
        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _companyUsers.Setup(x => x.GetByUserIdAsync(outsiderUserId, It.IsAny<CancellationToken>())).ReturnsAsync(outsiderMember);
        _companyUsers.Setup(x => x.GetByUserIdAsync(ownerUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(ownerMember);
        _storage.Setup(x => x.GetPresignedDownloadUrlAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://files.example/agreement.pdf");

        var currentHandler = new GetServiceAgreementQueryHandler(_agreements.Object, _jobs.Object, _companyUsers.Object);
        var historyHandler = new GetServiceAgreementHistoryQueryHandler(_agreements.Object, _jobs.Object, _companyUsers.Object);
        var downloadHandler = new GetServiceAgreementDownloadUrlQueryHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _storage.Object, _pdfRenderer.Object, _uow.Object);

        await FluentActions.Awaiting(() => currentHandler.Handle(new GetServiceAgreementQuery(job.JobId, null, outsiderUserId, false), CancellationToken.None))
            .Should().ThrowAsync<ForbiddenException>();
        await FluentActions.Awaiting(() => historyHandler.Handle(new GetServiceAgreementHistoryQuery(job.JobId, outsiderUserId, false), CancellationToken.None))
            .Should().ThrowAsync<ForbiddenException>();
        await FluentActions.Awaiting(() => downloadHandler.Handle(new GetServiceAgreementDownloadUrlQuery(job.JobId, agreementId, null, outsiderUserId, false), CancellationToken.None))
            .Should().ThrowAsync<ForbiddenException>();
        _pdfRenderer.Verify(x => x.RenderAgreementPdf(It.IsAny<ServiceAgreement>(), It.IsAny<Job>(), It.IsAny<Company>(), It.IsAny<bool>()), Times.Never);

        // Owner & backoffice succeed
        (await currentHandler.Handle(new GetServiceAgreementQuery(job.JobId, null, ownerUser.UserId, false), CancellationToken.None)).ServiceAgreementId.Should().Be(agreementId);
        (await historyHandler.Handle(new GetServiceAgreementHistoryQuery(job.JobId, outsiderUserId, true), CancellationToken.None)).Should().HaveCount(1);
        (await downloadHandler.Handle(new GetServiceAgreementDownloadUrlQuery(job.JobId, agreementId, null, ownerUser.UserId, false), CancellationToken.None)).DownloadUrl.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task SignAgreement_CvSourcing_WithoutDepositPercent_ShouldSetDefaultDepositPercent_AndEnsureDeposit()
    {
        var (job, company, clientUser, clientMember) = CreateTestJob("CV_SOURCING");
        job.Status = JobStatuses.PendingAgreement;
        job.DepositPercent = null;

        var agreementId = Guid.NewGuid();
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = agreementId,
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            Status = ServiceAgreementStatuses.Accepted,
            IsCurrent = true,
            ServiceTypeCode = ServiceTypeCodes.CvSourcing,
            SourcingTarget = 10,
            PricePerQualifiedCv = 500_000m,
            ReviewDays = 7,
            PaymentDueDays = 15,
            ConcurrencyToken = Guid.NewGuid(),
            CompanyNameSnapshot = company.CompanyName,
            SignerEmailSnapshot = clientUser.Email,
            VerificationCode = "HRC-SOURCING",
            CreatedByUserId = Guid.NewGuid()
        };
        var challenge = new ServiceAgreementSignatureChallenge
        {
            ChallengeId = Guid.NewGuid(),
            ServiceAgreementId = agreementId,
            SignerUserId = clientUser.UserId,
            OtpHash = "HASH_123456",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _agreements.Setup(x => x.GetActiveChallengeAsync(agreementId, clientUser.UserId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(challenge);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);
        _users.Setup(x => x.GetByIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientUser);
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        var adminSettings = new Mock<IAdminBusinessSettings>();
        adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, It.IsAny<CancellationToken>()))
            .ReturnsAsync(50m);

        var sourcingFinance = new Mock<ISourcingFinanceService>();
        sourcingFinance.Setup(x => x.EnsureDepositAsync(job, clientUser.UserId, It.IsAny<CancellationToken>(), ServiceTypeCodes.CvSourcing))
            .ReturnsAsync(new ServiceFee { ServiceFeeId = Guid.NewGuid(), Kind = ServiceFeeKinds.Deposit, Amount = 2_500_000m });

        var handler = new SignServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _users.Object, _otpService.Object,
            _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object,
            sourcingFinance.Object, adminSettings.Object);

        var result = await handler.Handle(new SignServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            Otp = "123456",
            ConsentAccepted = true,
            UserId = clientUser.UserId,
            ConcurrencyToken = agreement.ConcurrencyToken
        }, CancellationToken.None);

        result.Status.Should().Be(ServiceAgreementStatuses.Signed);
        job.DepositPercent.Should().Be(50m);
        job.Status.Should().Be(JobStatuses.PendingPayment);
        sourcingFinance.Verify(x => x.EnsureDepositAsync(job, clientUser.UserId, It.IsAny<CancellationToken>(), ServiceTypeCodes.CvSourcing), Times.Once);
    }

    [Fact]
    public async Task SignAgreement_CvSourcing_WhenDepositCreationReturnsNull_ShouldThrowConflictAndNotSetPendingPayment()
    {
        var (job, company, clientUser, clientMember) = CreateTestJob("CV_SOURCING");
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
            ServiceTypeCode = ServiceTypeCodes.CvSourcing,
            SourcingTarget = 10,
            PricePerQualifiedCv = 500_000m,
            ReviewDays = 7,
            PaymentDueDays = 15,
            ConcurrencyToken = Guid.NewGuid(),
            CompanyNameSnapshot = company.CompanyName,
            SignerEmailSnapshot = clientUser.Email,
            VerificationCode = "HRC-SOURCING",
            CreatedByUserId = Guid.NewGuid()
        };
        var challenge = new ServiceAgreementSignatureChallenge
        {
            ChallengeId = Guid.NewGuid(),
            ServiceAgreementId = agreementId,
            SignerUserId = clientUser.UserId,
            OtpHash = "HASH_123456",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _agreements.Setup(x => x.GetActiveChallengeAsync(agreementId, clientUser.UserId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(challenge);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);
        _users.Setup(x => x.GetByIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientUser);
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        var sourcingFinance = new Mock<ISourcingFinanceService>();
        sourcingFinance.Setup(x => x.EnsureDepositAsync(job, clientUser.UserId, It.IsAny<CancellationToken>(), ServiceTypeCodes.CvSourcing))
            .ReturnsAsync((ServiceFee?)null);

        var handler = new SignServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _users.Object, _otpService.Object,
            _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object,
            sourcingFinance.Object);

        var act = () => handler.Handle(new SignServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreementId,
            Otp = "123456",
            ConsentAccepted = true,
            UserId = clientUser.UserId,
            ConcurrencyToken = agreement.ConcurrencyToken
        }, CancellationToken.None);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("SOURCING_DEPOSIT_NOT_CREATED");
        job.Status.Should().Be(JobStatuses.PendingAgreement);
    }

    [Fact]
    public async Task CreateProposal_CvSourcing_WithDefaultValues_ShouldPersistResolvedTerms_AndAllowSignWithoutConflict()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("CV_SOURCING");
        job.ProposedPricePerCv = null;
        job.ProposedPaymentDueDays = null;
        job.SourcingTarget = null;
        job.ReviewDays = null;
        job.DepositPercent = null;

        var internalHrId = Guid.NewGuid();

        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync("CV_SOURCING");
        _agreements.Setup(x => x.GetHistoryByJobIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(new List<ServiceAgreement>());

        var adminSettings = new Mock<IAdminBusinessSettings>();
        adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, It.IsAny<CancellationToken>()))
            .ReturnsAsync(600_000m);
        adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, It.IsAny<CancellationToken>()))
            .ReturnsAsync(7);
        adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, It.IsAny<CancellationToken>()))
            .ReturnsAsync(20);
        adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, It.IsAny<CancellationToken>()))
            .ReturnsAsync(50m);

        ServiceAgreement? addedAgreement = null;
        _agreements.Setup(x => x.AddAsync(It.IsAny<ServiceAgreement>(), It.IsAny<CancellationToken>()))
            .Callback<ServiceAgreement, CancellationToken>((sa, _) => addedAgreement = sa)
            .Returns(Task.CompletedTask);

        var createHandler = new CreateServiceAgreementProposalCommandHandler(
            _jobs.Object, _agreements.Object, _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object, adminSettings.Object);

        // Act - create proposal with all terms null (default values)
        var proposalResult = await createHandler.Handle(new CreateServiceAgreementProposalCommand
        {
            JobId = job.JobId,
            UserId = internalHrId,
            ConcurrencyToken = job.ConcurrencyToken
        }, CancellationToken.None);

        // Assert - proposal has resolved non-null values
        proposalResult.PricePerQualifiedCv.Should().Be(600_000m);
        proposalResult.SourcingTarget.Should().Be(10);
        proposalResult.ReviewDays.Should().Be(7);
        proposalResult.PaymentDueDays.Should().Be(20);
        proposalResult.DepositPercent.Should().Be(50m);

        addedAgreement.Should().NotBeNull();
        addedAgreement!.PricePerQualifiedCv.Should().Be(600_000m);
        addedAgreement.SourcingTarget.Should().Be(10);
        addedAgreement.ReviewDays.Should().Be(7);
        addedAgreement.PaymentDueDays.Should().Be(20);

        // Client accepts proposal
        addedAgreement.Status = ServiceAgreementStatuses.Accepted;

        var challenge = new ServiceAgreementSignatureChallenge
        {
            ChallengeId = Guid.NewGuid(),
            ServiceAgreementId = addedAgreement.ServiceAgreementId,
            SignerUserId = clientUser.UserId,
            OtpHash = "HASH_123456",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(addedAgreement.ServiceAgreementId, It.IsAny<CancellationToken>())).ReturnsAsync(addedAgreement);
        _agreements.Setup(x => x.GetActiveChallengeAsync(addedAgreement.ServiceAgreementId, clientUser.UserId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(challenge);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);
        _users.Setup(x => x.GetByIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientUser);

        var sourcingFinance = new Mock<ISourcingFinanceService>();
        sourcingFinance.Setup(x => x.EnsureDepositAsync(job, clientUser.UserId, It.IsAny<CancellationToken>(), ServiceTypeCodes.CvSourcing))
            .ReturnsAsync(new ServiceFee { ServiceFeeId = Guid.NewGuid(), Kind = ServiceFeeKinds.Deposit, Amount = 3_000_000m });

        var signHandler = new SignServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _users.Object, _otpService.Object,
            _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object,
            sourcingFinance.Object, adminSettings.Object);

        // Act - Client signs with OTP
        var signResult = await signHandler.Handle(new SignServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = addedAgreement.ServiceAgreementId,
            Otp = "123456",
            ConsentAccepted = true,
            UserId = clientUser.UserId,
            ConcurrencyToken = addedAgreement.ConcurrencyToken
        }, CancellationToken.None);

        // Assert - Successfully signed and transitioned to PendingPayment
        signResult.Status.Should().Be(ServiceAgreementStatuses.Signed);
        job.Status.Should().Be(JobStatuses.PendingPayment);
        job.SourcingPricePerCv.Should().Be(600_000m);
        job.SourcingTarget.Should().Be(10);
        job.DepositPercent.Should().Be(50m);
        sourcingFinance.Verify(x => x.EnsureDepositAsync(job, clientUser.UserId, It.IsAny<CancellationToken>(), ServiceTypeCodes.CvSourcing), Times.Once);
    }

    [Fact]
    public async Task CreateProposal_HeadhuntCod_WithDefaultValues_ShouldPersistResolvedTerms()
    {
        // Arrange
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        job.ProposedFeeMultiplier = null;
        job.ProposedWarrantyDays = null;
        job.ProposedPaymentDueDays = null;

        var internalHrId = Guid.NewGuid();

        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync("HEADHUNT_COD");
        _agreements.Setup(x => x.GetHistoryByJobIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(new List<ServiceAgreement>());

        var adminSettings = new Mock<IAdminBusinessSettings>();
        adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1.5m);
        adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.HeadhuntWarrantyDays, It.IsAny<CancellationToken>()))
            .ReturnsAsync(30);
        adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, It.IsAny<CancellationToken>()))
            .ReturnsAsync(20);

        ServiceAgreement? addedAgreement = null;
        _agreements.Setup(x => x.AddAsync(It.IsAny<ServiceAgreement>(), It.IsAny<CancellationToken>()))
            .Callback<ServiceAgreement, CancellationToken>((sa, _) => addedAgreement = sa)
            .Returns(Task.CompletedTask);

        var createHandler = new CreateServiceAgreementProposalCommandHandler(
            _jobs.Object, _agreements.Object, _pdfRenderer.Object, _storage.Object, _notifications.Object, _audit.Object, _uow.Object, adminSettings.Object);

        // Act - create proposal with all terms null
        var proposalResult = await createHandler.Handle(new CreateServiceAgreementProposalCommand
        {
            JobId = job.JobId,
            UserId = internalHrId,
            ConcurrencyToken = job.ConcurrencyToken
        }, CancellationToken.None);

        // Assert - proposal has resolved non-null values
        proposalResult.FeeMultiplier.Should().Be(1.5m);
        proposalResult.WarrantyDays.Should().Be(30);
        proposalResult.PaymentDueDays.Should().Be(20);

        addedAgreement.Should().NotBeNull();
        addedAgreement!.FeeMultiplier.Should().Be(1.5m);
        addedAgreement.WarrantyDays.Should().Be(30);
        addedAgreement.PaymentDueDays.Should().Be(20);
    }

    [Fact]
    public async Task UploadSigned_FirstTimeAndReuploadBeforeHrConfirm_ShouldUploadAndUpdateSha256Hash()
    {
        var (job, company, clientUser, clientMember) = CreateTestJob("HEADHUNT_COD");
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = Guid.NewGuid(),
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            CompanyNameSnapshot = company.CompanyName,
            Version = 1,
            IsCurrent = true,
            Status = ServiceAgreementStatuses.SentToClient,
            CreatedByUserId = Guid.NewGuid(),
            ConcurrencyToken = Guid.NewGuid(),
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreement.ServiceAgreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _companyUsers.Setup(x => x.GetByUserIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientMember);
        _users.Setup(x => x.GetByIdAsync(clientUser.UserId, It.IsAny<CancellationToken>())).ReturnsAsync(clientUser);

        var uploadedBytes = new List<byte[]>();
        _storage.Setup(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<Stream, string, string, CancellationToken>((s, _, _, _) =>
            {
                using var copy = new MemoryStream();
                s.CopyTo(copy);
                uploadedBytes.Add(copy.ToArray());
            })
            .ReturnsAsync("agreements/signed.pdf");

        var handler = new UploadSignedServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _users.Object,
            _storage.Object, _notifications.Object, _audit.Object, _uow.Object);

        var firstBytes = new byte[] { 10, 20, 30, 40 };
        var expectedFirstHash = Convert.ToHexString(SHA256.HashData(firstBytes)).ToLowerInvariant();
        await using (var firstStream = new MemoryStream(firstBytes))
        {
            var firstResult = await handler.Handle(new UploadSignedServiceAgreementCommand
            {
                JobId = job.JobId,
                AgreementId = agreement.ServiceAgreementId,
                UserId = clientUser.UserId,
                FileStream = firstStream,
                FileName = "signed-v1.pdf",
                ContentType = "application/pdf",
                FileLength = firstBytes.Length,
            }, CancellationToken.None);

            firstResult.DocumentSha256Hash.Should().Be(expectedFirstHash);
            agreement.DocumentSha256Hash.Should().Be(expectedFirstHash);
        }

        // Re-upload before HR confirms (agreement status is still SENT_TO_CLIENT, not SIGNED)
        var secondBytes = new byte[] { 50, 60, 70, 80, 90 };
        var expectedSecondHash = Convert.ToHexString(SHA256.HashData(secondBytes)).ToLowerInvariant();
        await using (var secondStream = new MemoryStream(secondBytes))
        {
            var secondResult = await handler.Handle(new UploadSignedServiceAgreementCommand
            {
                JobId = job.JobId,
                AgreementId = agreement.ServiceAgreementId,
                UserId = clientUser.UserId,
                FileStream = secondStream,
                FileName = "signed-v2.pdf",
                ContentType = "application/pdf",
                FileLength = secondBytes.Length,
            }, CancellationToken.None);

            secondResult.DocumentSha256Hash.Should().Be(expectedSecondHash);
            secondResult.DocumentSha256Hash.Should().NotBe(expectedFirstHash);
            agreement.DocumentSha256Hash.Should().Be(expectedSecondHash);
        }

        uploadedBytes.Should().HaveCount(2);
        uploadedBytes[0].Should().Equal(firstBytes);
        uploadedBytes[1].Should().Equal(secondBytes);
    }

    [Theory]
    [InlineData(ServiceAgreementStatuses.Signed, "AGREEMENT_ALREADY_SIGNED")]
    [InlineData(ServiceAgreementStatuses.ChangeRequested, "AGREEMENT_CHANGE_REQUESTED")]
    public async Task UploadSigned_WhenSignedOrChangeRequested_ShouldThrowConflict(string status, string expectedErrorCode)
    {
        var (job, company, clientUser, _) = CreateTestJob("HEADHUNT_COD");
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = Guid.NewGuid(),
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            IsCurrent = true,
            Status = status,
            DocumentSha256Hash = "existing-hash",
        };

        _agreements.Setup(x => x.GetByIdForUpdateAsync(agreement.ServiceAgreementId, It.IsAny<CancellationToken>())).ReturnsAsync(agreement);
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        var handler = new UploadSignedServiceAgreementCommandHandler(
            _agreements.Object, _jobs.Object, _companyUsers.Object, _users.Object,
            _storage.Object, _notifications.Object, _audit.Object, _uow.Object);

        await using var stream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var act = () => handler.Handle(new UploadSignedServiceAgreementCommand
        {
            JobId = job.JobId,
            AgreementId = agreement.ServiceAgreementId,
            UserId = clientUser.UserId,
            FileStream = stream,
            FileName = "signed.pdf",
            ContentType = "application/pdf",
            FileLength = 4,
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ConflictException>();
        ex.Which.ErrorCode.Should().Be(expectedErrorCode);
        agreement.DocumentSha256Hash.Should().Be("existing-hash");
        _storage.Verify(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
