using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Commands.ApproveJob;
using HRConnect.Application.Features.Jobs.Commands.CloseJob;
using HRConnect.Application.Features.Jobs.Commands.PauseJob;
using HRConnect.Application.Features.Jobs.Commands.RejectJob;
using HRConnect.Application.Features.Jobs.Commands.ResumeJob;
using HRConnect.Application.Features.Jobs.Commands.SubmitJob;
using HRConnect.Application.Features.Jobs.Commands.UpdateJob;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Commands.RecordJobPostingFeePayment;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Jobs;

public class JobManagementCommandHandlerTests
{
    private readonly Mock<IJobRepository> _jobs = new();
    private readonly Mock<ICompanyUserRepository> _members = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IAdminBusinessSettings> _adminSettings = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _uow = new();

    public JobManagementCommandHandlerTests()
    {
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvApplicationFreeActiveLimit, It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvApplicationFreeCooldownMonths, It.IsAny<CancellationToken>())).ReturnsAsync(2);
        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier, It.IsAny<CancellationToken>())).ReturnsAsync(1.5m);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.HeadhuntWarrantyDays, It.IsAny<CancellationToken>())).ReturnsAsync(30);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, It.IsAny<CancellationToken>())).ReturnsAsync(20);
        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingPricePerCv, It.IsAny<CancellationToken>())).ReturnsAsync(600000m);
        _adminSettings.Setup(x => x.GetDecimalAsync(BusinessSettingKeys.CvSourcingDepositPercent, It.IsAny<CancellationToken>())).ReturnsAsync(50m);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, It.IsAny<CancellationToken>())).ReturnsAsync(7);
        _adminSettings.Setup(x => x.GetIntAsync(BusinessSettingKeys.CvSourcingPaymentDueDays, It.IsAny<CancellationToken>())).ReturnsAsync(20);

        var defaultFreePackage = new JobPostingPackage
        {
            PackageId = Guid.NewGuid(),
            Code = JobPostingPackageCodes.Free,
            Name = "Gói Miễn Phí",
            Price = 0,
            DurationDays = 30,
            IsActive = true
        };
        _jobs.Setup(x => x.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, It.IsAny<CancellationToken>()))
            .ReturnsAsync(defaultFreePackage);
    }

    [Fact]
    public async Task Update_ShouldReplaceDraftFieldsAndRequirements()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft); var serviceType = Guid.NewGuid();
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.ShouldHave));
        var existingSkill = new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid(), IsMandatory = false, Weight = 0.2m };
        job.JobSkills.Add(existingSkill);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(serviceType, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var result = await new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId,
            UserId = user,
            ServiceTypeId = serviceType,
            Title = " Senior Dev ",
            Description = " API development ",
            Benefits = " Health insurance and annual bonus ",
            WorkingTime = " Monday-Friday, 08:00-17:30 ",
            MinExperienceYears = 2,
            MaxExperienceYears = 4,
            SalaryMin = 20_000_000,
            SalaryMax = 30_000_000,
            SalaryNegotiable = false,
            SalaryNote = " Có thể thương lượng thêm thưởng dự án ",
            CurrencyCode = "usd",
            Quantity = 2,
            Requirements = [new CreateJobRequirementRequest { RequirementType = "must_have", Content = "C#" }],
            Skills = [new JobSkillRequest { SkillId = existingSkill.SkillId, IsMandatory = true, Weight = 0.8m }]
        }, default);
        result.Data.Title.Should().Be("Senior Dev"); result.Data.ServiceTypeId.Should().Be(serviceType);
        result.Data.Benefits.Should().Be("Health insurance and annual bonus");
        result.Data.WorkingTime.Should().Be("Monday-Friday, 08:00-17:30");
        result.Data.MinExperienceYears.Should().Be(2m);
        result.Data.MaxExperienceYears.Should().Be(4m);
        result.Data.SalaryNegotiable.Should().BeFalse();
        result.Data.SalaryNote.Should().Be("Có thể thương lượng thêm thưởng dự án");
        job.CurrencyCode.Should().Be("USD");
        job.MinExperienceYears.Should().Be(2m);
        job.MaxExperienceYears.Should().Be(4m);
        job.SalaryNegotiable.Should().BeFalse();
        job.WorkingTime.Should().Be("Monday-Friday, 08:00-17:30");
        job.SalaryNote.Should().Be("Có thể thương lượng thêm thưởng dự án");
        job.JobRequirements.Should().ContainSingle(x => x.RequirementType == JobRequirementTypes.MustHave);
        job.JobSkills.Should().ContainSingle().Which.Should().BeSameAs(existingSkill);
        existingSkill.IsMandatory.Should().BeTrue();
        existingSkill.Weight.Should().Be(0.8m);
        _jobs.Verify(x => x.Update(It.IsAny<Job>()), Times.Never);
    }

    [Fact]
    public async Task Update_ShouldAllowServiceTypeChangeForDraftWithoutCandidateActivity()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        var newServiceTypeId = Guid.NewGuid();
        _jobs.Setup(x => x.HasSubmissionsOrApplicationsAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(newServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId, UserId = user, ServiceTypeId = newServiceTypeId,
            Title = "Draft job", CurrencyCode = "VND", Quantity = 1
        }, default);

        result.Data.ServiceTypeId.Should().Be(newServiceTypeId);
        _jobs.Verify(x => x.HasSubmissionsOrApplicationsAsync(job.JobId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_ShouldRejectServiceTypeChangeForRejectedJob()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Rejected);

        var action = () => new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId, UserId = user, ServiceTypeId = Guid.NewGuid(),
            Title = "Rejected job", CurrencyCode = "VND", Quantity = 1
        }, default);

        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("*DRAFT*");
        _jobs.Verify(x => x.HasSubmissionsOrApplicationsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Update_ShouldRejectServiceTypeChangeWhenDraftHasCandidateActivity()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        _jobs.Setup(x => x.HasSubmissionsOrApplicationsAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var action = () => new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId, UserId = user, ServiceTypeId = Guid.NewGuid(),
            Title = "Draft job", CurrencyCode = "VND", Quantity = 1
        }, default);

        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("*hồ sơ ứng tuyển* hoặc *lượt giới thiệu*");
        _jobs.Verify(x => x.GetActiveServiceTypeCodeAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Submit_ShouldMoveCompleteOwnedDraftToPendingReview()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs"; job.Benefits = "Insurance and training";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid(), IsMandatory = true });
        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, Price = 1_000_000m, IsActive = true };
        job.PostingPackageId = stdPkg.PackageId;
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(stdPkg.PackageId, It.IsAny<CancellationToken>())).ReturnsAsync(stdPkg);
        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);
        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        job.JobStatusHistories.Should().ContainSingle(x => x.OldStatus == JobStatuses.Draft && x.NewStatus == JobStatuses.PendingReview);
    }

    [Fact]
    public async Task Submit_ShouldNotifyEveryActiveInternalHr()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs"; job.Benefits = "Insurance and training";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, Price = 1_000_000m, IsActive = true };
        job.PostingPackageId = stdPkg.PackageId;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(stdPkg.PackageId, It.IsAny<CancellationToken>())).ReturnsAsync(stdPkg);
        var hrIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid() };
        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetActiveUserIdsByRoleAsync("INTERNAL_HR", It.IsAny<CancellationToken>())).ReturnsAsync(hrIds);
        var sent = new List<Notification>();
        _notifications.Setup(x => x.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .Callback<Notification, CancellationToken>((n, _) => sent.Add(n)).Returns(Task.CompletedTask);

        await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object, users.Object, _notifications.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        sent.Select(n => n.UserId).Should().BeEquivalentTo(hrIds);
        sent.Should().OnlyContain(n => n.RelatedEntityId == job.JobId && n.RelatedEntityType == "JOB" && n.Metadata!.Contains("/hr/jobs"));
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Submit_ShouldAllowCompleteJobWithoutSkills()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs"; job.Benefits = "Insurance and training";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, Price = 1_000_000m, IsActive = true };
        job.PostingPackageId = stdPkg.PackageId;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(stdPkg.PackageId, It.IsAny<CancellationToken>())).ReturnsAsync(stdPkg);

        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        _jobs.Verify(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Submit_ShouldKeepDraft_WhenMandatoryDataIsMissing()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);
        await action.Should().ThrowAsync<BadRequestException>(); job.Status.Should().Be(JobStatuses.Draft);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("title")]
    [InlineData("description")]
    [InlineData("benefits")]
    [InlineData("location")]
    [InlineData("employmentType")]
    [InlineData("mustHave")]
    public async Task Submit_ShouldRejectEachMissingRequiredJdPart(string missingPart)
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = missingPart == "title" ? "" : "Backend Developer";
        job.Description = missingPart == "description" ? null : "Build APIs";
        job.Benefits = missingPart == "benefits" ? null : "Insurance and training";
        job.Location = missingPart == "location" ? null : "HCM";
        job.EmploymentType = missingPart == "employmentType" ? null : "FULL_TIME";
        if (missingPart != "mustHave") job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid() });
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);

        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>();
        job.Status.Should().Be(JobStatuses.Draft);
    }

    [Fact]
    public async Task RejectUpdateResubmitApprove_ShouldPreserveCompleteStatusHistory()
    {
        var (job, owner) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs"; job.Benefits = "Insurance and training"; job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid() });
        var freePkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Free, Price = 0, IsActive = true };
        job.PostingPackageId = freePkg.PackageId;
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(freePkg.PackageId, It.IsAny<CancellationToken>())).ReturnsAsync(freePkg);
        _jobs.Setup(x => x.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, It.IsAny<CancellationToken>())).ReturnsAsync(freePkg);
        var submit = new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object);

        await submit.Handle(new SubmitJobCommand { JobId = job.JobId, UserId = owner, ConcurrencyToken = job.ConcurrencyToken }, default);
        await new RejectJobCommandHandler(_jobs.Object, _notifications.Object, _uow.Object).Handle(
            new RejectJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), ConcurrencyToken = job.ConcurrencyToken, ReasonCode = JobReasonCodes.RejectedIncompleteDescription, ReasonText = "Bổ sung JD" }, default);
        await new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId,
            UserId = owner,
            ConcurrencyToken = job.ConcurrencyToken,
            ServiceTypeId = job.ServiceTypeId,
            PostingPackageId = freePkg.PackageId,
            Title = "Backend Developer Updated",
            Description = "Build APIs",
            Benefits = "Insurance, annual bonus and training",
            Location = "HCM",
            EmploymentType = "FULL_TIME",
            CurrencyCode = "VND",
            Quantity = 1,
            Requirements = [new CreateJobRequirementRequest { RequirementType = JobRequirementTypes.MustHave, Content = "C#" }],
            Skills = [new JobSkillRequest { SkillId = job.JobSkills.Single().SkillId, IsMandatory = true, Weight = 0.8m }]
        }, default);
        await submit.Handle(new SubmitJobCommand { JobId = job.JobId, UserId = owner, ConcurrencyToken = job.ConcurrencyToken }, default);
        await new ApproveJobCommandHandler(_jobs.Object, _adminSettings.Object, _notifications.Object, _audit.Object, _uow.Object).Handle(
            new ApproveJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), ConcurrencyToken = job.ConcurrencyToken }, default);

        job.Status.Should().Be(JobStatuses.Active);
        job.JobStatusHistories.Select(x => x.NewStatus).Should().Equal(
            JobStatuses.PendingReview, JobStatuses.Rejected, JobStatuses.PendingReview, JobStatuses.Active);
        job.JobStatusHistories.Single(x => x.NewStatus == JobStatuses.Rejected).ReasonText.Should().Be("Bổ sung JD");
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(n => n.NotificationType == "JOB" && n.UserId == job.CreatedBy), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Approve_ShouldPublishPendingJob()
    {
        var job = SetupJob(JobStatuses.PendingReview); var reviewer = Guid.NewGuid();
        var result = await new ApproveJobCommandHandler(_jobs.Object, _adminSettings.Object, _notifications.Object, _audit.Object, _uow.Object)
            .Handle(new ApproveJobCommand { JobId = job.JobId, UserId = reviewer }, default);
        result.Data.Status.Should().Be(JobStatuses.Active); job.PostedAt.Should().NotBeNull();
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(n => n.NotificationType == "JOB" && n.UserId == job.CreatedBy && n.RelatedEntityId == job.JobId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Reject_ShouldReturnPendingJobWithReason()
    {
        var job = SetupJob(JobStatuses.PendingReview);
        var result = await new RejectJobCommandHandler(_jobs.Object, _notifications.Object, _uow.Object)
            .Handle(new RejectJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), ReasonCode = JobReasonCodes.RejectedIncompleteDescription, ReasonText = "JD chưa rõ" }, default);
        result.Data.Status.Should().Be(JobStatuses.Rejected); job.StatusReason.Should().Be("JD chưa rõ");
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(n => n.NotificationType == "JOB" && n.UserId == job.CreatedBy && n.RelatedEntityId == job.JobId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PauseResumeClose_ShouldFollowStateMachineAndWriteHistory()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Active);
        await new PauseJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new PauseJobCommand { JobId = job.JobId, UserId = user, ConcurrencyToken = job.ConcurrencyToken, ReasonText = "Đủ CV" }, default);
        job.Status.Should().Be(JobStatuses.Paused);
        await new ResumeJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new ResumeJobCommand { JobId = job.JobId, UserId = user, ConcurrencyToken = job.ConcurrencyToken }, default);
        job.Status.Should().Be(JobStatuses.Active);
        await new CloseJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new CloseJobCommand { JobId = job.JobId, UserId = user, ConcurrencyToken = job.ConcurrencyToken, ReasonCode = JobReasonCodes.ClosedPositionFilled, ReasonText = "Đã tuyển đủ" }, default);
        job.Status.Should().Be(JobStatuses.Closed); job.ClosedAt.Should().NotBeNull(); job.JobStatusHistories.Should().HaveCount(3);
    }

    [Fact]
    public async Task ClientAction_ShouldRejectJobOwnedByAnotherCompany()
    {
        var job = SetupJob(JobStatuses.Active); var user = Guid.NewGuid();
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(Member(user, Guid.NewGuid()));
        var action = () => new PauseJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new PauseJobCommand { JobId = job.JobId, UserId = user }, default);
        await action.Should().ThrowAsync<ForbiddenException>(); job.Status.Should().Be(JobStatuses.Active);
    }

    [Fact]
    public async Task ClosedJob_ShouldRejectFurtherTransition()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Closed);
        var action = () => new ResumeJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new ResumeJobCommand { JobId = job.JobId, UserId = user }, default);
        await action.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Update_ShouldRejectStaleConcurrencyToken()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.ConcurrencyToken = Guid.NewGuid();

        var action = () => new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId, UserId = user, ConcurrencyToken = Guid.NewGuid(),
            ServiceTypeId = job.ServiceTypeId, Title = "Stale update", CurrencyCode = "VND", Quantity = 1
        }, default);

        await action.Should().ThrowAsync<ConflictException>();
        job.Title.Should().BeEmpty();
    }

    [Theory]
    [InlineData(JobStatuses.Draft, JobStatuses.Active)]
    [InlineData(JobStatuses.PendingReview, JobStatuses.Paused)]
    [InlineData(JobStatuses.Rejected, JobStatuses.Active)]
    [InlineData(JobStatuses.Closed, JobStatuses.Active)]
    public void JobTransitions_ShouldRejectTransitionsOutsideMf01StateMachine(string from, string to)
    {
        var job = SetupJob(from);
        var action = () => JobTransitions.ChangeStatus(job, to, Guid.NewGuid(), "TEST");

        action.Should().Throw<ConflictException>();
        job.Status.Should().Be(from);
        job.JobStatusHistories.Should().BeEmpty();
    }

    [Fact]
    public async Task Submit_CvSourcing_ShouldRequireSourcingTarget()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Senior Sourcing"; job.Description = "Sourcing JD"; job.Benefits = "Good";
        job.Location = "HN"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvSourcing);

        // Trường hợp không có SourcingTarget
        job.SourcingTarget = null;
        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);
        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Sourcing Target*");

        // Trường hợp SourcingTarget <= 0
        job.SourcingTarget = 0;
        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Sourcing Target*");
    }

    [Fact]
    public async Task Submit_CvSourcing_ShouldNotSetDefaultSourcingPrice_WhenNotProvided()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Senior Sourcing"; job.Description = "Sourcing JD"; job.Benefits = "Good";
        job.Location = "HN"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.SourcingTarget = 5;
        job.SourcingPricePerCv = null;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvSourcing);

        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        job.SourcingTarget.Should().Be(5);
        job.SourcingPricePerCv.Should().BeNull();
        job.FeeMultiplier.Should().BeNull();
        job.WarrantyDays.Should().BeNull();
    }

    [Fact]
    public async Task Submit_HeadhuntCod_ShouldNotSetDefaultCommercialTerms_WhenNotProvided()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "CTO Headhunt"; job.Description = "CTO JD"; job.Benefits = "Equity";
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.FeeMultiplier = null;
        job.WarrantyDays = null;
        job.PaymentDueDays = null;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.HeadhuntCod);

        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        job.FeeMultiplier.Should().BeNull();
        job.WarrantyDays.Should().BeNull();
        job.PaymentDueDays.Should().BeNull();
        job.SourcingTarget.Should().BeNull();
    }

    [Fact]
    public async Task Submit_CvApplication_WithoutPackage_ShouldFail_JobPostingPackageRequired()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Frontend Dev"; job.Description = "React JD"; job.Benefits = "Lunch";
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.PostingPackageId = null;

        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvApplication);

        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("JOB_POSTING_PACKAGE_REQUIRED*");
    }

    [Fact]
    public async Task Submit_CvApplication_FreePackage_ShouldSucceed_WhenWithinLimits()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Frontend Dev Free"; job.Description = "React JD"; job.Benefits = "Lunch";
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));

        var freePkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Free, Name = "Gói Miễn Phí", Price = 0, DurationDays = 30, IsActive = true };
        job.PostingPackageId = freePkg.PackageId;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(freePkg.PackageId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(freePkg);
        _jobs.Setup(x => x.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, It.IsAny<CancellationToken>()))
            .ReturnsAsync(freePkg);
        _jobs.Setup(x => x.CountActiveJobsByCompanyIdAsync(job.CompanyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
        _jobs.Setup(x => x.GetLastPostedJobByCompanyIdAsync(job.CompanyId, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Job?)null);

        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        job.PostingPackageId.Should().Be(freePkg.PackageId);
        _jobs.Verify(x => x.AddPostingFeeAsync(It.Is<JobPostingFee>(f => f.Amount == 0 && f.Status == JobPostingFeeStatuses.Paid), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Submit_CvApplication_FreePackage_ShouldFail_WhenActiveJobLimitExceeded()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Frontend Dev Free"; job.Description = "React JD"; job.Benefits = "Lunch";
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));

        var freePkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Free, Name = "Gói Miễn Phí", Price = 0, DurationDays = 30, IsActive = true };
        job.PostingPackageId = freePkg.PackageId;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(freePkg.PackageId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(freePkg);
        _jobs.Setup(x => x.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, It.IsAny<CancellationToken>()))
            .ReturnsAsync(freePkg);
        _jobs.Setup(x => x.CountActiveJobsByCompanyIdAsync(job.CompanyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1); // Đã có 1 job active

        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*tối đa 1 tin*");
    }

    [Fact]
    public async Task Submit_CvApplication_FreePackage_ShouldFail_WhenCooldownNotMet()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Frontend Dev Free"; job.Description = "React JD"; job.Benefits = "Lunch";
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));

        var freePkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Free, Name = "Gói Miễn Phí", Price = 0, DurationDays = 30, IsActive = true };
        job.PostingPackageId = freePkg.PackageId;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(freePkg.PackageId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(freePkg);
        _jobs.Setup(x => x.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, It.IsAny<CancellationToken>()))
            .ReturnsAsync(freePkg);
        _jobs.Setup(x => x.CountActiveJobsByCompanyIdAsync(job.CompanyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        var prevJob = new Job { JobId = Guid.NewGuid(), PostedAt = DateTime.UtcNow.AddDays(-20) };
        _jobs.Setup(x => x.GetLastPostedJobByCompanyIdAsync(job.CompanyId, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(prevJob);

        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*chu kỳ*");
    }

    [Fact]
    public async Task Submit_CvApplication_StandardPackage_ShouldSucceed_WithoutPrePayment()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Frontend Dev Standard"; job.Description = "React JD"; job.Benefits = "Lunch";
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));

        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, Name = "Gói Trả Phí", Price = 1_500_000m, DurationDays = 30, MaxApplications = 50, IsActive = true };
        job.PostingPackageId = stdPkg.PackageId;

        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobs.Setup(x => x.GetPostingPackageByIdAsync(stdPkg.PackageId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stdPkg);

        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        job.MaxApplications.Should().Be(50);
        _jobs.Verify(x => x.AddPostingFeeAsync(It.Is<JobPostingFee>(f => f.Status == JobPostingFeeStatuses.Pending), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Approve_StandardPackage_ShouldTransitionToPendingPayment_WhenUnpaid()
    {
        var job = SetupJob(JobStatuses.PendingReview);
        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, DurationDays = 30, MaxApplications = 50 };
        job.PostingPackageId = stdPkg.PackageId;
        job.PostingPackage = stdPkg;

        var fee = new JobPostingFee { JobId = job.JobId, PackageId = stdPkg.PackageId, Status = JobPostingFeeStatuses.Pending, Amount = 1_500_000m };
        _jobs.Setup(x => x.GetPostingFeeByJobIdAsync(job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fee);

        var result = await new ApproveJobCommandHandler(_jobs.Object, _adminSettings.Object, _notifications.Object, _audit.Object, _uow.Object)
            .Handle(new ApproveJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), ConcurrencyToken = job.ConcurrencyToken }, default);

        result.Data.Status.Should().Be(JobStatuses.PendingPayment);
        job.Status.Should().Be(JobStatuses.PendingPayment);
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(n => n.Title.Contains("duyệt nội dung")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Approve_StandardPackage_ShouldTransitionToActive_WhenPaymentReferenceProvided()
    {
        var job = SetupJob(JobStatuses.PendingReview);
        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, DurationDays = 30, MaxApplications = 50 };
        job.PostingPackageId = stdPkg.PackageId;
        job.PostingPackage = stdPkg;

        var fee = new JobPostingFee { JobId = job.JobId, PackageId = stdPkg.PackageId, Status = JobPostingFeeStatuses.Pending, Amount = 1_500_000m };
        _jobs.Setup(x => x.GetPostingFeeByJobIdAsync(job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fee);

        var result = await new ApproveJobCommandHandler(_jobs.Object, _adminSettings.Object, _notifications.Object, _audit.Object, _uow.Object)
            .Handle(new ApproveJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), ConcurrencyToken = job.ConcurrencyToken, PaymentReference = "REF_123456" }, default);

        result.Data.Status.Should().Be(JobStatuses.Active);
        fee.Status.Should().Be(JobPostingFeeStatuses.Paid);
        job.ExpiresAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Approve_StandardPackage_ShouldSucceed_WhenAlreadyPaid()
    {
        var job = SetupJob(JobStatuses.PendingReview);
        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, DurationDays = 30 };
        job.PostingPackageId = stdPkg.PackageId;
        job.PostingPackage = stdPkg;

        var fee = new JobPostingFee { JobId = job.JobId, PackageId = stdPkg.PackageId, Status = JobPostingFeeStatuses.Paid, Amount = 1_500_000m };
        _jobs.Setup(x => x.GetPostingFeeByJobIdAsync(job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fee);

        var result = await new ApproveJobCommandHandler(_jobs.Object, _adminSettings.Object, _notifications.Object, _audit.Object, _uow.Object)
            .Handle(new ApproveJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), ConcurrencyToken = job.ConcurrencyToken }, default);

        result.Data.Status.Should().Be(JobStatuses.Active);
        job.ExpiresAt.Should().NotBeNull();
        job.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(30), TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task RecordPayment_WhenPendingPayment_ShouldActivateJob()
    {
        var job = SetupJob(JobStatuses.PendingPayment);
        var stdPkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Standard, DurationDays = 30 };
        job.PostingPackageId = stdPkg.PackageId;
        job.PostingPackage = stdPkg;

        var fee = new JobPostingFee
        {
            PostingFeeId = Guid.NewGuid(),
            JobId = job.JobId,
            PackageId = stdPkg.PackageId,
            CompanyId = job.CompanyId,
            Status = JobPostingFeeStatuses.Pending,
            Amount = 1_500_000m,
            Package = stdPkg
        };
        _jobs.Setup(x => x.GetPostingFeeByJobIdAsync(job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fee);

        var handler = new RecordJobPostingFeePaymentCommandHandler(_jobs.Object, _notifications.Object, _uow.Object);
        var result = await handler.Handle(new RecordJobPostingFeePaymentCommand
        {
            JobId = job.JobId,
            UserId = Guid.NewGuid(),
            PaymentReference = "PAY_SUCCESS_123"
        }, default);

        result.Status.Should().Be(JobPostingFeeStatuses.Paid);
        job.Status.Should().Be(JobStatuses.Active);
        job.PostedAt.Should().NotBeNull();
        job.ExpiresAt.Should().NotBeNull();
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(n => n.Title.Contains("kích hoạt")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Resume_FreeJob_ShouldFail_WhenAnotherJobActive()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Paused);
        var freePkg = new JobPostingPackage { PackageId = Guid.NewGuid(), Code = JobPostingPackageCodes.Free };
        job.PostingPackageId = freePkg.PackageId;
        job.PostingPackage = freePkg;
        job.ExpiresAt = DateTime.UtcNow.AddDays(10);

        _jobs.Setup(x => x.CountActiveJobsByCompanyIdAsync(job.CompanyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var action = () => new ResumeJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new ResumeJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*tối đa 1 tin*");
    }

    [Fact]
    public async Task Resume_Job_ShouldFail_WhenExpired()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Paused);
        job.ExpiresAt = DateTime.UtcNow.AddDays(-1); // Hết hạn hôm qua

        var action = () => new ResumeJobCommandHandler(_jobs.Object, _members.Object, _adminSettings.Object, _uow.Object)
            .Handle(new ResumeJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đã hết hạn*");
    }

    private (Job Job, Guid User) SetupOwnedJob(string status)
    {
        var job = SetupJob(status); var user = Guid.NewGuid();
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(Member(user, job.CompanyId));
        return (job, user);
    }
    private Job SetupJob(string status)
    {
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = Guid.NewGuid(),
            ServiceTypeId = Guid.NewGuid(),
            CreatedBy = Guid.NewGuid(),
            Title = "",
            CurrencyCode = "VND",
            Quantity = 1,
            Status = status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        job.ServiceType = new ServiceType
        {
            ServiceTypeId = job.ServiceTypeId,
            Code = ServiceTypeCodes.CvApplication,
            Name = "Đăng tin ứng tuyển"
        };
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        return job;
    }
    private static CompanyUser Member(Guid user, Guid company) => new() { CompanyUserId = Guid.NewGuid(), UserId = user, CompanyId = company, Status = "ACTIVE" };
    private static JobRequirement Requirement(Guid job, string type) => new() { RequirementId = Guid.NewGuid(), JobId = job, RequirementType = type, Content = "3 years", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
}
