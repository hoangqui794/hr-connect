using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HRConnect.UnitTests.Persistence;

public sealed class NotificationTypeConstraintTests
{
    // IAppNotifier sends these types: recording a service fee payment, a resignation report and a CV delivery
    // failed with a 500 while the database constraint did not list them.
    [Theory]
    [InlineData("SERVICE_FEE")]
    [InlineData("WARRANTY")]
    [InlineData("SOURCING")]
    [InlineData("INTERVIEW")]
    [InlineData("APPLICATION_STATUS")]
    [InlineData("SYSTEM")]
    public void Notification_type_constraint_allows_every_type_the_notifier_sends(string type)
    {
        using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);

        var model = context.GetService<IDesignTimeModel>().Model;
        var constraint = model.FindEntityType(typeof(Notification))!.GetCheckConstraints()
            .Single(c => c.Name == "ck_notification_type");

        constraint.Sql.Should().Contain($"'{type}'");
    }

    // The list above only covers types someone remembered to add: confirming a resignation failed with a 500 because
    // it sent "PLACEMENT". Handler tests mock IAppNotifier, so read the type literals in the source code instead.
    // Not seen: a type passed through a helper parameter (SettlementCommands.NotifyAsync).
    [Fact]
    public void Notification_type_constraint_allows_every_type_literal_in_the_source_code()
    {
        using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);
        var constraint = context.GetService<IDesignTimeModel>().Model.FindEntityType(typeof(Notification))!
            .GetCheckConstraints().Single(c => c.Name == "ck_notification_type");
        var allowed = Regex.Matches(constraint.Sql, "'([^']+)'").Select(match => match.Groups[1].Value).ToHashSet();

        // The first argument of an AppNotice, or what is assigned to NotificationType ("==" is a comparison).
        // Every literal of the expression counts, so both branches of a conditional are checked.
        var typeExpression = new Regex(@"\bnew\s+AppNotice\s*\((?<type>[^,)]*)|NotificationType\s*=(?!=)(?<type>[^,;}]*)");
        var root = SolutionDirectory();
        var used = new[] { "HRConnect.Application", "HRConnect.Infrastructure", "HRConnect.Presentation" }
            .SelectMany(project => Directory.EnumerateFiles(Path.Combine(root, project), "*.cs", SearchOption.AllDirectories))
            .Select(file => (Path: file, Name: Path.GetRelativePath(root, file)))
            .Where(file => !file.Name.Split(Path.DirectorySeparatorChar).Any(part => part is "bin" or "obj" or "Migrations"))
            .SelectMany(file => typeExpression.Matches(File.ReadAllText(file.Path))
                .SelectMany(match => Regex.Matches(match.Groups["type"].Value, "\"([^\"]*)\""))
                .Select(literal => (Type: literal.Groups[1].Value, File: file.Name)))
            .ToList();

        // One type from each form, so a pattern that silently stops matching does not pass.
        used.Select(item => item.Type).Should().Contain(["SERVICE_FEE", "JOB_FIT"]);
        used.Where(item => !allowed.Contains(item.Type)).Should().BeEmpty(
            "PostgreSQL rejects a notification whose type is not in ck_notification_type");
    }

    // Tests may be built with "-o" into a folder outside the repository; the path of this file is the fallback.
    private static string SolutionDirectory([CallerFilePath] string sourceFile = "")
    {
        foreach (var start in new[] { AppContext.BaseDirectory, sourceFile })
        {
            var directory = new DirectoryInfo(start);
            while (directory != null && !File.Exists(Path.Combine(directory.FullName, "HRConnect.sln")))
            {
                directory = directory.Parent;
            }

            if (directory != null)
            {
                return directory.FullName;
            }
        }

        throw new DirectoryNotFoundException("Cannot find the folder that contains HRConnect.sln.");
    }
}
