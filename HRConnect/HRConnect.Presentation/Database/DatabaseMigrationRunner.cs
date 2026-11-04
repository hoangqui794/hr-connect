using HRConnect.Application.Common.Interfaces;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Presentation.Database;

public static class DatabaseMigrationRunner
{
    public static async Task RunAsync(
        IServiceProvider services,
        IHostEnvironment environment,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var emailNormalizer = scope.ServiceProvider.GetRequiredService<IEmailNormalizer>();
        var phoneNormalizer = scope.ServiceProvider.GetRequiredService<IPhoneNormalizer>();

        await dbContext.Database.MigrateAsync(cancellationToken);

        var enableDemoAccounts = !environment.IsProduction()
            && (environment.IsDevelopment()
                || environment.IsEnvironment("Testing")
                || environment.IsEnvironment("Demo")
                || configuration.GetValue<bool>("SeedDemoAccounts", false));

        await DatabaseSeeder.SeedAsync(
            dbContext,
            logger,
            seedDemoAccounts: enableDemoAccounts,
            passwordHasher: passwordHasher,
            emailNormalizer: emailNormalizer,
            phoneNormalizer: phoneNormalizer);

        logger.LogInformation(
            "Database migration completed. Demo data enabled: {DemoDataEnabled}",
            enableDemoAccounts);
    }
}
