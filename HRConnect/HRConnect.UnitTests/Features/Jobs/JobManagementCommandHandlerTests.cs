using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Commands.ApproveJob;
using HRConnect.Application.Features.Jobs.Commands.CloseJob;
using HRConnect.Application.Features.Jobs.Commands.PauseJob;
using HRConnect.Application.Features.Jobs.Commands.RejectJob;
using HRConnect.Application.Features.Jobs.Commands.ResumeJob;
using HRConnect.Application.Features.Jobs.Commands.SubmitJob;
using HRConnect.Application.Features.Jobs.Commands.UpdateJob;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Jobs;

public class JobManagementCommandHandlerTests
{
    private readonly Mock<IJobRepository> _jobs = new();
    private readonly Mock<ICompanyUserRepository> _members = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IUnitOfWork> _uow = new();

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
            Visibility = JobVisibilities.Public,
            Quantity = 2,
            Requirements = [new CreateJobRequirementRequest { RequirementType = "must_have", Content = "C#" }],
            Skills = [new JobSkillRequest { SkillId = existingSkill.SkillId, IsMandatory = true, Weight = 0.8m }]
        }, default);
        result.Data.Title.Should().Be("Senior Dev"); result.Data.ServiceTypeId.Should().Be(serviceType);
        result.Data.Benefits.Should().Be("Health insurance and annual bonus");
        result.Data.WorkingTime.Should().Be("Monday-Friday, 08:00-17:30");
        result.Data.MinExperienceYears.Should().Be(2);
        result.Data.MaxExperienceYears.Should().Be(4);
        result.Data.SalaryNegotiable.Should().BeFalse();
        result.Data.SalaryNote.Should().Be("Có thể thương lượng thêm thưởng dự án");
        job.CurrencyCode.Should().Be("USD");
        job.MinExperienceYears.Should().Be(2);
        job.MaxExperienceYears.Should().Be(4);
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
            Title = "Draft job", CurrencyCode = "VND", Quantity = 1, Visibility = "PUBLIC"
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
            Title = "Rejected job", CurrencyCode = "VND", Quantity = 1, Visibility = "PUBLIC"
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
            Title = "Draft job", CurrencyCode = "VND", Quantity = 1, Visibility = "PUBLIC"
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
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);
        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        job.JobStatusHistories.Should().ContainSingle(x => x.OldStatus == JobStatuses.Draft && x.NewStatus == JobStatuses.PendingReview);
    }

    [Fact]
    public async Task Submit_ShouldAllowCompleteJobWithoutSkills()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs"; job.Benefits = "Insurance and training";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);

        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        _jobs.Verify(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Submit_ShouldKeepDraft_WhenMandatoryDataIsMissing()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);
        await action.Should().ThrowAsync<BadRequestException>(); job.Status.Should().Be(JobStatuses.Draft);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Submit_ShouldKeepDraft_WhenVisibilityDoesNotMatchServiceType()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs"; job.Benefits = "Insurance";
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid() });
        job.Visibility = JobVisibilities.Public;
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvSourcing);

        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>();
        job.Status.Should().Be(JobStatuses.Draft);
        job.JobStatusHistories.Should().BeEmpty();
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

        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
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
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(ServiceTypeCodes.CvApplication);
        var submit = new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object);

        await submit.Handle(new SubmitJobCommand { JobId = job.JobId, UserId = owner, ConcurrencyToken = job.ConcurrencyToken }, default);
        await new RejectJobCommandHandler(_jobs.Object, _notifications.Object, _uow.Object).Handle(
            new RejectJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), ConcurrencyToken = job.ConcurrencyToken, ReasonCode = JobReasonCodes.RejectedIncompleteDescription, ReasonText = "Bổ sung JD" }, default);
        await new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId,
            UserId = owner,
            ConcurrencyToken = job.ConcurrencyToken,
            ServiceTypeId = job.ServiceTypeId,
            Title = "Backend Developer Updated",
            Description = "Build APIs",
            Benefits = "Insurance, annual bonus and training",
            Location = "HCM",
            EmploymentType = "FULL_TIME",
            CurrencyCode = "VND",
            Quantity = 1,
            Visibility = "PUBLIC",
            Requirements = [new CreateJobRequirementRequest { RequirementType = JobRequirementTypes.MustHave, Content = "C#" }],
            Skills = [new JobSkillRequest { SkillId = job.JobSkills.Single().SkillId, IsMandatory = true, Weight = 0.8m }]
        }, default);
        await submit.Handle(new SubmitJobCommand { JobId = job.JobId, UserId = owner, ConcurrencyToken = job.ConcurrencyToken }, default);
        await new ApproveJobCommandHandler(_jobs.Object, _notifications.Object, _uow.Object).Handle(
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
        var result = await new ApproveJobCommandHandler(_jobs.Object, _notifications.Object, _uow.Object)
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
        await new ResumeJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
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
        var action = () => new ResumeJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
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
            ServiceTypeId = job.ServiceTypeId, Title = "Stale update", CurrencyCode = "VND", Quantity = 1, Visibility = "PUBLIC"
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
            Visibility = "PUBLIC",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job); return job;
    }
    private static CompanyUser Member(Guid user, Guid company) => new() { CompanyUserId = Guid.NewGuid(), UserId = user, CompanyId = company, Status = "ACTIVE" };
    private static JobRequirement Requirement(Guid job, string type) => new() { RequirementId = Guid.NewGuid(), JobId = job, RequirementType = type, Content = "3 years", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
}
