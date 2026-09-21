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
    private readonly Mock<IUnitOfWork> _uow = new();

    [Fact]
    public async Task Update_ShouldReplaceDraftFieldsAndRequirements()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft); var serviceType = Guid.NewGuid();
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.ShouldHave));
        var existingSkill = new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid(), IsMandatory = false, Weight = 0.2m };
        job.JobSkills.Add(existingSkill);
        _jobs.Setup(x => x.IsServiceTypeActiveAsync(serviceType, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var result = await new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId, UserId = user, ServiceTypeId = serviceType, Title = " Senior Dev ",
            Description = " API development ", CurrencyCode = "usd", Visibility = "private", Quantity = 2,
            Requirements = [new CreateJobRequirementRequest { RequirementType = "must_have", Content = "C#" }],
            Skills = [new JobSkillRequest { SkillId = existingSkill.SkillId, IsMandatory = true, Weight = 0.8m }]
        }, default);
        result.Data.Title.Should().Be("Senior Dev"); result.Data.ServiceTypeId.Should().Be(serviceType);
        job.CurrencyCode.Should().Be("USD"); job.JobRequirements.Should().ContainSingle(x => x.RequirementType == JobRequirementTypes.MustHave);
        job.JobSkills.Should().ContainSingle().Which.Should().BeSameAs(existingSkill);
        existingSkill.IsMandatory.Should().BeTrue();
        existingSkill.Weight.Should().Be(0.8m);
        _jobs.Verify(x => x.Update(It.IsAny<Job>()), Times.Never);
    }

    [Fact]
    public async Task Submit_ShouldMoveCompleteOwnedDraftToPendingReview()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid(), IsMandatory = true });
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.IsServiceTypeActiveAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var result = await new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);
        result.Data.Status.Should().Be(JobStatuses.PendingReview);
        job.JobStatusHistories.Should().ContainSingle(x => x.OldStatus == JobStatuses.Draft && x.NewStatus == JobStatuses.PendingReview);
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

    [Theory]
    [InlineData("title")]
    [InlineData("description")]
    [InlineData("location")]
    [InlineData("employmentType")]
    [InlineData("mustHave")]
    [InlineData("skill")]
    public async Task Submit_ShouldRejectEachMissingRequiredJdPart(string missingPart)
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = missingPart == "title" ? "" : "Backend Developer";
        job.Description = missingPart == "description" ? null : "Build APIs";
        job.Location = missingPart == "location" ? null : "HCM";
        job.EmploymentType = missingPart == "employmentType" ? null : "FULL_TIME";
        if (missingPart != "mustHave") job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        if (missingPart != "skill") job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid() });
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.IsServiceTypeActiveAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var action = () => new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new SubmitJobCommand { JobId = job.JobId, UserId = user }, default);

        await action.Should().ThrowAsync<BadRequestException>();
        job.Status.Should().Be(JobStatuses.Draft);
    }

    [Fact]
    public async Task RejectUpdateResubmitApprove_ShouldPreserveCompleteStatusHistory()
    {
        var (job, owner) = SetupOwnedJob(JobStatuses.Draft);
        job.Title = "Backend Developer"; job.Description = "Build APIs"; job.Location = "HCM"; job.EmploymentType = "FULL_TIME";
        job.JobRequirements.Add(Requirement(job.JobId, JobRequirementTypes.MustHave));
        job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = Guid.NewGuid() });
        _jobs.Setup(x => x.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _jobs.Setup(x => x.IsServiceTypeActiveAsync(job.ServiceTypeId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var submit = new SubmitJobCommandHandler(_jobs.Object, _members.Object, _uow.Object);

        await submit.Handle(new SubmitJobCommand { JobId = job.JobId, UserId = owner }, default);
        await new RejectJobCommandHandler(_jobs.Object, _uow.Object).Handle(
            new RejectJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), Reason = "Bổ sung JD" }, default);
        await new UpdateJobCommandHandler(_jobs.Object, _members.Object, _uow.Object).Handle(new UpdateJobCommand
        {
            JobId = job.JobId, UserId = owner, ServiceTypeId = job.ServiceTypeId,
            Title = "Backend Developer Updated", Description = "Build APIs", Location = "HCM",
            EmploymentType = "FULL_TIME", CurrencyCode = "VND", Quantity = 1, Visibility = "PUBLIC",
            Requirements = [new CreateJobRequirementRequest { RequirementType = JobRequirementTypes.MustHave, Content = "C#" }],
            Skills = [new JobSkillRequest { SkillId = job.JobSkills.Single().SkillId, IsMandatory = true, Weight = 0.8m }]
        }, default);
        await submit.Handle(new SubmitJobCommand { JobId = job.JobId, UserId = owner }, default);
        await new ApproveJobCommandHandler(_jobs.Object, _uow.Object).Handle(
            new ApproveJobCommand { JobId = job.JobId, UserId = Guid.NewGuid() }, default);

        job.Status.Should().Be(JobStatuses.Active);
        job.JobStatusHistories.Select(x => x.NewStatus).Should().Equal(
            JobStatuses.PendingReview, JobStatuses.Rejected, JobStatuses.PendingReview, JobStatuses.Active);
        job.JobStatusHistories.Single(x => x.NewStatus == JobStatuses.Rejected).Reason.Should().Be("Bổ sung JD");
    }

    [Fact]
    public async Task Approve_ShouldPublishPendingJob()
    {
        var job = SetupJob(JobStatuses.PendingReview); var reviewer = Guid.NewGuid();
        var result = await new ApproveJobCommandHandler(_jobs.Object, _uow.Object)
            .Handle(new ApproveJobCommand { JobId = job.JobId, UserId = reviewer }, default);
        result.Data.Status.Should().Be(JobStatuses.Active); job.PostedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Reject_ShouldReturnPendingJobWithReason()
    {
        var job = SetupJob(JobStatuses.PendingReview);
        var result = await new RejectJobCommandHandler(_jobs.Object, _uow.Object)
            .Handle(new RejectJobCommand { JobId = job.JobId, UserId = Guid.NewGuid(), Reason = "JD chưa rõ" }, default);
        result.Data.Status.Should().Be(JobStatuses.Rejected); job.StatusReason.Should().Be("JD chưa rõ");
    }

    [Fact]
    public async Task PauseResumeClose_ShouldFollowStateMachineAndWriteHistory()
    {
        var (job, user) = SetupOwnedJob(JobStatuses.Active);
        await new PauseJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new PauseJobCommand { JobId = job.JobId, UserId = user, Reason = "Đủ CV" }, default);
        job.Status.Should().Be(JobStatuses.Paused);
        await new ResumeJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new ResumeJobCommand { JobId = job.JobId, UserId = user }, default);
        job.Status.Should().Be(JobStatuses.Active);
        await new CloseJobCommandHandler(_jobs.Object, _members.Object, _uow.Object)
            .Handle(new CloseJobCommand { JobId = job.JobId, UserId = user, Reason = "Đã tuyển đủ" }, default);
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

    private (Job Job, Guid User) SetupOwnedJob(string status)
    {
        var job = SetupJob(status); var user = Guid.NewGuid();
        _members.Setup(x => x.GetByUserIdAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(Member(user, job.CompanyId));
        return (job, user);
    }
    private Job SetupJob(string status)
    {
        var job = new Job { JobId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), ServiceTypeId = Guid.NewGuid(), CreatedBy = Guid.NewGuid(),
            Title = "", CurrencyCode = "VND", Quantity = 1, Status = status, Visibility = "PUBLIC", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job); return job;
    }
    private static CompanyUser Member(Guid user, Guid company) => new() { CompanyUserId = Guid.NewGuid(), UserId = user, CompanyId = company, Status = "ACTIVE" };
    private static JobRequirement Requirement(Guid job, string type) => new() { RequirementId = Guid.NewGuid(), JobId = job, RequirementType = type, Content = "3 years", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
}
