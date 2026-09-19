using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Persistence;

public class ServiceTypeSeederTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task SeedAsync_ShouldInsertAllThreeRows_WhenTableIsEmpty()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var loggerMock = new Mock<ILogger>();

        // Act
        await ServiceTypeSeeder.SeedAsync(context, loggerMock.Object);

        // Assert
        var serviceTypes = await context.ServiceTypes.ToListAsync();
        serviceTypes.Should().HaveCount(3);

        var cvApp = serviceTypes.FirstOrDefault(s => s.Code == "CV_APPLICATION");
        cvApp.Should().NotBeNull();
        cvApp!.Name.Should().Be("CV Application");
        cvApp.Description.Should().Be("Open candidate application service");
        cvApp.IsActive.Should().BeTrue();
        cvApp.CreatedAt.Should().NotBe(default);
        cvApp.UpdatedAt.Should().NotBe(default);

        var headhuntCod = serviceTypes.FirstOrDefault(s => s.Code == "HEADHUNT_COD");
        headhuntCod.Should().NotBeNull();
        headhuntCod!.Name.Should().Be("Headhunt COD");
        headhuntCod.Description.Should().Be("Commission-based headhunting service");
        headhuntCod.IsActive.Should().BeTrue();

        var cvSourcing = serviceTypes.FirstOrDefault(s => s.Code == "CV_SOURCING");
        cvSourcing.Should().NotBeNull();
        cvSourcing!.Name.Should().Be("CV Sourcing");
        cvSourcing.Description.Should().Be("Candidate CV sourcing service");
        cvSourcing.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task SeedAsync_ShouldInsertNothing_WhenAllThreeAlreadyExist()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var now = DateTime.UtcNow;

        var existingList = new[]
        {
            new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_APPLICATION", Name = "Existing App", Description = "Existing Desc", IsActive = true, CreatedAt = now, UpdatedAt = now },
            new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "HEADHUNT_COD", Name = "Existing COD", Description = "Existing Desc", IsActive = true, CreatedAt = now, UpdatedAt = now },
            new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_SOURCING", Name = "Existing Sourcing", Description = "Existing Desc", IsActive = true, CreatedAt = now, UpdatedAt = now }
        };

        await context.ServiceTypes.AddRangeAsync(existingList);
        await context.SaveChangesAsync();

        // Act
        await ServiceTypeSeeder.SeedAsync(context);

        // Assert
        var serviceTypes = await context.ServiceTypes.ToListAsync();
        serviceTypes.Should().HaveCount(3);
        serviceTypes.Select(s => s.Name).Should().BeEquivalentTo(new[] { "Existing App", "Existing COD", "Existing Sourcing" });
    }

    [Fact]
    public async Task SeedAsync_ShouldInsertOnlyMissingRows_WhenOnlyCvApplicationExists()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var existingId = Guid.NewGuid();
        var existingCvApp = new ServiceType
        {
            ServiceTypeId = existingId,
            Code = "CV_APPLICATION",
            Name = "Pre-existing CV Application",
            Description = "Pre-existing Desc",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await context.ServiceTypes.AddAsync(existingCvApp);
        await context.SaveChangesAsync();

        // Act
        await ServiceTypeSeeder.SeedAsync(context);

        // Assert
        var serviceTypes = await context.ServiceTypes.ToListAsync();
        serviceTypes.Should().HaveCount(3);

        // Pre-existing CV_APPLICATION must be preserved with its original ID and Name
        var cvApp = serviceTypes.First(s => s.Code == "CV_APPLICATION");
        cvApp.ServiceTypeId.Should().Be(existingId);
        cvApp.Name.Should().Be("Pre-existing CV Application");

        // Missing 2 rows must have been added
        serviceTypes.Should().Contain(s => s.Code == "HEADHUNT_COD");
        serviceTypes.Should().Contain(s => s.Code == "CV_SOURCING");
    }

    [Fact]
    public async Task SeedAsync_ShouldPreserveExistingRowWithDifferentUuid_AndNotCreateDuplicate()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customId1 = Guid.Parse("47c0371f-c78b-44b0-8ff3-6f04490649c1");
        var customId2 = Guid.Parse("89a20708-a245-4b3e-8cba-689c1fbdc121");
        var customId3 = Guid.Parse("c8ab1876-dd17-483d-ac9c-24590d910903");

        await context.ServiceTypes.AddRangeAsync(
            new ServiceType { ServiceTypeId = customId1, Code = "CV_APPLICATION", Name = "Custom UUID 1", Description = "Desc", IsActive = true },
            new ServiceType { ServiceTypeId = customId2, Code = "HEADHUNT_COD", Name = "Custom UUID 2", Description = "Desc", IsActive = true },
            new ServiceType { ServiceTypeId = customId3, Code = "CV_SOURCING", Name = "Custom UUID 3", Description = "Desc", IsActive = true }
        );
        await context.SaveChangesAsync();

        // Act
        await ServiceTypeSeeder.SeedAsync(context);

        // Assert
        var serviceTypes = await context.ServiceTypes.ToListAsync();
        serviceTypes.Should().HaveCount(3);
        serviceTypes.First(s => s.Code == "CV_APPLICATION").ServiceTypeId.Should().Be(customId1);
        serviceTypes.First(s => s.Code == "HEADHUNT_COD").ServiceTypeId.Should().Be(customId2);
        serviceTypes.First(s => s.Code == "CV_SOURCING").ServiceTypeId.Should().Be(customId3);
    }

    [Fact]
    public async Task SeedAsync_ShouldBeIdempotent_WhenRunMultipleTimes()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        // Act - Run 3 times consecutively
        await ServiceTypeSeeder.SeedAsync(context);
        await ServiceTypeSeeder.SeedAsync(context);
        await ServiceTypeSeeder.SeedAsync(context);

        // Assert
        var serviceTypes = await context.ServiceTypes.ToListAsync();
        serviceTypes.Should().HaveCount(3);
        serviceTypes.Select(s => s.Code).Distinct().Should().HaveCount(3);
    }

    [Fact]
    public async Task SeedAsync_ShouldPreserveExistingIds_WhenPartiallySeeded()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var customHeadhuntId = Guid.NewGuid();

        await context.ServiceTypes.AddAsync(new ServiceType
        {
            ServiceTypeId = customHeadhuntId,
            Code = "HEADHUNT_COD",
            Name = "Original Headhunt",
            Description = "Original Desc",
            IsActive = true
        });
        await context.SaveChangesAsync();

        // Act
        await ServiceTypeSeeder.SeedAsync(context);

        // Assert
        var headhunt = await context.ServiceTypes.FirstAsync(s => s.Code == "HEADHUNT_COD");
        headhunt.ServiceTypeId.Should().Be(customHeadhuntId);
        headhunt.Name.Should().Be("Original Headhunt");

        var all = await context.ServiceTypes.ToListAsync();
        all.Should().HaveCount(3);
    }

    [Fact]
    public async Task DatabaseSeeder_SeedAsync_ShouldAlsoSeedServiceTypes()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        // Act
        await DatabaseSeeder.SeedAsync(context);

        // Assert: Both roles and service types are seeded
        var serviceTypes = await context.ServiceTypes.ToListAsync();
        serviceTypes.Should().HaveCount(3);
        serviceTypes.Select(s => s.Code).Should().BeEquivalentTo(new[] { "CV_APPLICATION", "HEADHUNT_COD", "CV_SOURCING" });

        var roles = await context.Roles.ToListAsync();
        roles.Should().HaveCount(5);
    }
}
