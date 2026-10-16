using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.SavedJobs.Commands.SaveJob;
using HRConnect.Application.Features.Candidates.SavedJobs.Commands.UnsaveJob;
using HRConnect.Application.Features.Candidates.SavedJobs.Queries.GetCandidateSavedJobs;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class CandidateSavedJobsTests
{
    private readonly Mock<ICandidateRepository> _candidateRepo = new();
    private readonly Mock<IJobRepository> _jobRepo = new();
    private readonly Mock<ICandidateSavedJobRepository> _savedJobRepo = new();
    private readonly Mock<IUnitOfWork> _uow = new();

    [Fact]
    public async Task SaveJob_ShouldSucceed_WhenJobIsVisibleToCandidate()
    {
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, FullName = "Candidate A", Status = "ACTIVE" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.Active,
            ServiceTypeId = Guid.NewGuid(),
            Title = "DevOps Engineer"
        };

        _candidateRepo.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(candidate);
        _jobRepo.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobRepo.Setup(x => x.CanAnyRoleViewJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _savedJobRepo.Setup(x => x.IsSavedAsync(candidate.CandidateId, job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _savedJobRepo.Setup(x => x.AddAsync(It.IsAny<CandidateSavedJob>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var handler = new SaveJobCommandHandler(_candidateRepo.Object, _jobRepo.Object, _savedJobRepo.Object, _uow.Object);
        var result = await handler.Handle(new SaveJobCommand(userId, job.JobId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Lưu việc làm thành công.");
        result.SavedJobId.Should().NotBeNull();
        _savedJobRepo.Verify(x => x.AddAsync(It.IsAny<CandidateSavedJob>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SaveJob_ShouldBeIdempotent_WhenJobAlreadySaved()
    {
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, FullName = "Candidate A", Status = "ACTIVE" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.Active,
            ServiceTypeId = Guid.NewGuid(),
            Title = "DevOps Engineer"
        };

        _candidateRepo.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(candidate);
        _jobRepo.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _jobRepo.Setup(x => x.CanAnyRoleViewJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _savedJobRepo.Setup(x => x.IsSavedAsync(candidate.CandidateId, job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var handler = new SaveJobCommandHandler(_candidateRepo.Object, _jobRepo.Object, _savedJobRepo.Object, _uow.Object);
        var result = await handler.Handle(new SaveJobCommand(userId, job.JobId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Việc làm đã được lưu từ trước.");
        _savedJobRepo.Verify(x => x.AddAsync(It.IsAny<CandidateSavedJob>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SaveJob_ShouldThrowForbidden_WhenJobNotVisibleToCandidate()
    {
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, FullName = "Candidate A", Status = "ACTIVE" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = JobStatuses.Active, // Not visible to candidate
            ServiceTypeId = Guid.NewGuid(),
            Title = "Partner Only Job"
        };

        _candidateRepo.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(candidate);
        _jobRepo.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);

        var handler = new SaveJobCommandHandler(_candidateRepo.Object, _jobRepo.Object, _savedJobRepo.Object, _uow.Object);
        var action = () => handler.Handle(new SaveJobCommand(userId, job.JobId), CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UnsaveJob_ShouldBeIdempotent_WhetherJobExistedOrNot()
    {
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, FullName = "Candidate A", Status = "ACTIVE" };
        var jobId = Guid.NewGuid();

        _candidateRepo.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(candidate);
        _savedJobRepo.Setup(x => x.RemoveAsync(candidate.CandidateId, jobId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var handler = new UnsaveJobCommandHandler(_candidateRepo.Object, _savedJobRepo.Object, _uow.Object);
        var result = await handler.Handle(new UnsaveJobCommand(userId, jobId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Đã xóa việc làm khỏi danh sách đã lưu.");
    }

    [Fact]
    public async Task GetCandidateSavedJobs_ShouldReturnPaginatedList()
    {
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId, FullName = "Candidate A", Status = "ACTIVE" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Frontend React Developer",
            CompanyId = Guid.NewGuid(),
            ServiceTypeId = Guid.NewGuid(),
            Status = JobStatuses.Active,
            CurrencyCode = "VND",
            Company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Tech Corp" },
            ServiceType = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_APPLICATION" }
        };

        var savedJob = new CandidateSavedJob
        {
            CandidateSavedJobId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            JobId = job.JobId,
            Job = job,
            CreatedAt = DateTime.UtcNow
        };

        _candidateRepo.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(candidate);
        _savedJobRepo.Setup(x => x.GetSavedJobsAsync(candidate.CandidateId, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([savedJob], 1));

        var handler = new GetCandidateSavedJobsQueryHandler(_candidateRepo.Object, _savedJobRepo.Object);
        var result = await handler.Handle(new GetCandidateSavedJobsQuery(userId, 1, 20), CancellationToken.None);

        result.Items.Should().ContainSingle();
        result.TotalCount.Should().Be(1);
        result.Items[0].Job.Title.Should().Be("Frontend React Developer");
        result.Items[0].Job.CompanyName.Should().Be("Tech Corp");
        result.Items[0].Job.IsAcceptingApplications.Should().BeTrue();
    }
}
