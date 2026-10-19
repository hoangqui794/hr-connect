using HRConnect.Application.Common.Models;
using HRConnect.Infrastructure;
using Microsoft.Extensions.Configuration;

namespace HRConnect.UnitTests;

public sealed class DependencyInjectionR2ConfigurationTests
{
    [Fact]
    public void Production_MissingStorageConfiguration_FailsFastWithoutSecretValues()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ASPNETCORE_ENVIRONMENT"] = "Production"
            })
            .Build();

        var action = () => DependencyInjection.ValidateProductionR2Settings(new R2Settings(), configuration);

        var exception = Assert.Throws<InvalidOperationException>(action);
        Assert.Contains("R2_ACCESS_KEY_ID", exception.Message);
        Assert.Contains("PUBLIC_API_BASE_URL", exception.Message);
    }

    [Fact]
    public void Production_CompleteHttpsConfiguration_PassesValidation()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DOTNET_ENVIRONMENT"] = "Production"
            })
            .Build();
        var settings = new R2Settings
        {
            AccountId = "account-id",
            AccessKeyId = "access-key",
            SecretAccessKey = "secret-key",
            BucketName = "hrconnect-files",
            Endpoint = "https://account-id.r2.cloudflarestorage.com",
            PublicApiBaseUrl = "https://api.hrconnect.example"
        };

        DependencyInjection.ValidateProductionR2Settings(settings, configuration);
    }

    [Fact]
    public void Development_AllowsLocalStorageConfigurationToBeAbsent()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ASPNETCORE_ENVIRONMENT"] = "Development"
            })
            .Build();

        DependencyInjection.ValidateProductionR2Settings(new R2Settings(), configuration);
    }
}
