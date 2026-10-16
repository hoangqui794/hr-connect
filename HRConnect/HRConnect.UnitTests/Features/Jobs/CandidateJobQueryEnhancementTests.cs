using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;
using HRConnect.Application.Features.Candidates.Commands.ApplyJob;
using HRConnect.Application.Features.Jobs.Commands.SubmitJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Jobs.Queries.GetJobDetail;
using HRConnect.Application.Features.Jobs.Queries.GetPublicJobs;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

public class CandidateJobQueryEnhancementTests
{
    private readonly Mock<IJobRepository> _jobs = new();
    private readonly Mock<ICompanyUserRepository> _members = new();

    [Theory]
    [InlineData("INVALID")]
    [InlineData("TITLE")]
    [InlineData("DATE")]
    public async Task GetPublicJobs_ShouldRejectInvalidSortBy_WithVietnameseErrorMessage(string invalidSortBy)
    {
        var handler = new GetPublicJobsQueryHandler(_jobs.Object);
        var query = new GetPublicJobsQuery(
            [JobAccessPolicy.CandidateRole],
            false,
            null,
            null,
            null,
            SortBy: invalidSortBy);

        var action = () => handler.Handle(query, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<BadRequestException>();
        exception.Which.Message.Should().Be("sortBy chỉ chấp nhận POSTED_AT hoặc SALARY.");
    }

    [Theory]
    [InlineData("UP")]
    [InlineData("DOWN")]
    [InlineData("RANDOM")]
    public async Task GetPublicJobs_ShouldRejectInvalidSortDirection_WithVietnameseErrorMessage(string invalidSortDirection)
    {
        var handler = new GetPublicJobsQueryHandler(_jobs.Object);
        var query = new GetPublicJobsQuery(
            [JobAccessPolicy.CandidateRole],
            false,
            null,
            null,
            null,
            SortBy: "POSTED_AT",
            SortDirection: invalidSortDirection);

        var action = () => handler.Handle(query, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<BadRequestException>();
        exception.Which.Message.Should().Be("sortDirection chỉ chấp nhận DESC hoặc ASC.");
    }

    [Fact]
    public async Task GetPublicJobs_ShouldPassValidatedSortParametersToRepository()
    {
        var handler = new GetPublicJobsQueryHandler(_jobs.Object);
        var visibleJob = CreateTestJob(Guid.NewGuid(), JobStatuses.Active);

        _jobs.Setup(x => x.GetVisibleJobsAsync(
                It.IsAny<IReadOnlyCollection<string>>(),
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                1,
                20,
                "SALARY",
                "DESC",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([visibleJob], 1));

        var query = new GetPublicJobsQuery(
            [JobAccessPolicy.CandidateRole],
            false,
            null,
            null,
            null,
            SortBy: "salary",
            SortDirection: "desc");

        var result = await handler.Handle(query, CancellationToken.None);

        result.Items.Should().ContainSingle();
        _jobs.VerifyAll();
    }

    [Fact]
    public void IsAcceptingApplications_ShouldBeTrue_WhenActiveAndNoDeadline()
    {
        var job = CreateTestJob(Guid.NewGuid(), JobStatuses.Active);
        job.ApplicationDeadline = null;

        JobAccessPolicy.IsAcceptingApplications(job).Should().BeTrue();
    }

    [Fact]
    public void IsAcceptingApplications_ShouldBeTrue_WhenActiveAndDeadlineInFuture()
    {
        var job = CreateTestJob(Guid.NewGuid(), JobStatuses.Active);
        job.ApplicationDeadline = DateTime.UtcNow.AddDays(7);

        JobAccessPolicy.IsAcceptingApplications(job).Should().BeTrue();
    }

    [Fact]
    public void IsAcceptingApplications_ShouldBeFalse_WhenActiveAndDeadlinePassed()
    {
        var job = CreateTestJob(Guid.NewGuid(), JobStatuses.Active);
        job.ApplicationDeadline = DateTime.UtcNow.AddMinutes(-10);

        JobAccessPolicy.IsAcceptingApplications(job).Should().BeFalse();
    }

    [Fact]
    public void IsAcceptingApplications_ShouldBeFalse_WhenJobNotActiveEvenIfDeadlineInFuture()
    {
        var job = CreateTestJob(Guid.NewGuid(), JobStatuses.Paused);
        job.ApplicationDeadline = DateTime.UtcNow.AddDays(7);

        JobAccessPolicy.IsAcceptingApplications(job).Should().BeFalse();
    }

    [Fact]
    public async Task GetJobDetail_ShouldReturnPublicSanitizedCompanyWithoutSensitiveFields()
    {
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Acme Corp",
            TaxCode = "0123456789-SENSITIVE",
            Industry = "Information Technology",
            CompanySize = "100-500",
            Website = "https://acme.com",
            Address = "District 1, Ho Chi Minh City",
            Description = "Leading tech enterprise",
            VerificationStatus = "VERIFIED",
            VerifiedAt = DateTime.UtcNow
        };

        var job = CreateTestJob(company.CompanyId, JobStatuses.Active);
        job.Company = company;

        _jobs.Setup(x => x.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync(job);
        _members.Setup(x => x.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);
        _jobs.Setup(x => x.CanAnyRoleViewJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var handler = new GetJobDetailQueryHandler(_jobs.Object, _members.Object);
        var result = await handler.Handle(new GetJobDetailQuery(job.JobId, Guid.NewGuid(), false, [JobAccessPolicy.CandidateRole]), CancellationToken.None);

        result.Company.Should().NotBeNull();
        result.Company!.CompanyId.Should().Be(company.CompanyId);
        result.Company.CompanyName.Should().Be("Acme Corp");
        result.Company.Industry.Should().Be("Information Technology");
        result.Company.CompanySize.Should().Be("100-500");
        result.Company.Website.Should().Be("https://acme.com");
        result.Company.Address.Should().Be("District 1, Ho Chi Minh City");
        result.Company.Description.Should().Be("Leading tech enterprise");
        result.Company.IsVerified.Should().BeTrue();
        result.Company.LogoUrl.Should().BeNull();

        // Ensure sensitive fields do NOT exist on PublicCompanyDto contract
        typeof(PublicCompanyDto).GetProperty("TaxCode").Should().BeNull();
    }

    [Fact]
    public void PublicCompanyDto_ShouldHandleNullableAndInvalidWebsites()
    {
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Test Co",
            VerificationStatus = "UNVERIFIED",
            Website = "invalid-url",
            Address = null,
            Description = null
        };

        var dto = PublicCompanyDto.From(company);

        dto.Should().NotBeNull();
        dto!.IsVerified.Should().BeFalse();
        dto.Address.Should().BeNull();
        dto.Description.Should().BeNull();
    }

    private static Job CreateTestJob(Guid companyId, string status) => new()
    {
        JobId = Guid.NewGuid(),
        CompanyId = companyId,
        ServiceTypeId = Guid.NewGuid(),
        CreatedBy = Guid.NewGuid(),
        Title = "Senior Backend Engineer",
        Description = "Build scalable APIs",
        Benefits = "Premium Healthcare",
        Location = "Ho Chi Minh City",
        EmploymentType = "FULL_TIME",
        CurrencyCode = "VND",
        Quantity = 2,
        Status = status,
        PostedAt = DateTime.UtcNow,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        ConcurrencyToken = Guid.NewGuid()
    };
}
