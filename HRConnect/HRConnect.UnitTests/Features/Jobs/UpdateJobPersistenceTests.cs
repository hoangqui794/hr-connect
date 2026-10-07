using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Commands.UpdateJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace HRConnect.UnitTests.Features.Jobs;

/// <summary>
/// Runs UpdateJob against a real EF context. Mock-based tests cannot catch how EF
/// classifies child rows added to a tracked Job (INSERT vs UPDATE).
/// </summary>
public sealed class UpdateJobPersistenceTests
{
    [Fact]
    public async Task Update_WhenAddingRequirementToExistingJob_ShouldInsertIt()
    {
        var databaseName = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var token = Guid.NewGuid();

        await using (var seed = CreateContext(databaseName))
        {
            seed.Companies.Add(new Company
            {
                CompanyId = companyId,
                CompanyName = "Tech Corp",
                VerificationStatus = "VERIFIED",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            seed.ServiceTypes.Add(new ServiceType
            {
                ServiceTypeId = serviceTypeId,
                Code = ServiceTypeCodes.CvApplication,
                Name = "CV Application",
                IsActive = true
            });
            seed.Jobs.Add(new Job
            {
                JobId = jobId,
                CompanyId = companyId,
                ServiceTypeId = serviceTypeId,
                CreatedBy = userId,
                Title = "Backend",
                CurrencyCode = "VND",
                Quantity = 1,
                Status = JobStatuses.Draft,
                Visibility = JobVisibilities.Public,
                ConcurrencyToken = token,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                JobRequirements =
                {
                    new JobRequirement
                    {
                        RequirementId = Guid.NewGuid(),
                        JobId = jobId,
                        RequirementType = JobRequirementTypes.MustHave,
                        Content = "2+ năm ASP.NET Core",
                        CreatedAt = DateTime.UtcNow.AddMinutes(-1),
                        UpdatedAt = DateTime.UtcNow.AddMinutes(-1)
                    }
                }
            });
            await seed.SaveChangesAsync();
        }

        await using var context = CreateContext(databaseName);
        var members = new Mock<ICompanyUserRepository>();
        members.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken ct) => context.SaveChangesAsync(ct));

        var result = await new UpdateJobCommandHandler(new JobRepository(context), members.Object, uow.Object)
            .Handle(new UpdateJobCommand
            {
                JobId = jobId,
                UserId = userId,
                ConcurrencyToken = token,
                ServiceTypeId = serviceTypeId,
                Title = "Backend",
                CurrencyCode = "VND",
                Quantity = 1,
                Visibility = JobVisibilities.Public,
                Requirements =
                [
                    new CreateJobRequirementRequest { RequirementType = JobRequirementTypes.MustHave, Content = "2+ năm ASP.NET Core" },
                    new CreateJobRequirementRequest { RequirementType = JobRequirementTypes.ShouldHave, Content = "Biết Docker" }
                ]
            }, CancellationToken.None);

        result.Data.Requirements.Should().HaveCount(2);
        await using var verify = CreateContext(databaseName);
        var stored = await verify.JobRequirements.Where(x => x.JobId == jobId).ToListAsync();
        stored.Should().HaveCount(2);
        stored.Should().ContainSingle(x => x.Content == "Biết Docker" && x.RequirementType == JobRequirementTypes.ShouldHave);
    }

    private static ApplicationDbContext CreateContext(string databaseName) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(databaseName).Options);
}
