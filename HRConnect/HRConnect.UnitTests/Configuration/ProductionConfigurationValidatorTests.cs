using FluentAssertions;
using HRConnect.Presentation.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Moq;

namespace HRConnect.UnitTests.Configuration;

public class ProductionConfigurationValidatorTests
{
    [Fact]
    public void Validate_NonProduction_AllowsMissingValues()
    {
        var configuration = BuildConfiguration([]);

        var action = () => ProductionConfigurationValidator.Validate(
            configuration,
            BuildEnvironment(Environments.Development));

        action.Should().NotThrow();
    }

    [Fact]
    public void Validate_ProductionWithMissingValues_ListsConfigurationKeysWithoutValues()
    {
        var configuration = BuildConfiguration([]);

        var action = () => ProductionConfigurationValidator.Validate(
            configuration,
            BuildEnvironment(Environments.Production));

        var exception = action.Should().Throw<InvalidOperationException>().Which;
        exception.Message.Should().Contain("JwtSettings:Secret");
        exception.Message.Should().Contain("Cors:AllowedOrigins");
        exception.Message.Should().Contain("ConnectionStrings:DefaultConnection");
    }

    [Fact]
    public void Validate_ProductionWithLegacyJwtSecret_RejectsPlaceholder()
    {
        var values = ValidValues();
        values["JwtSettings:Secret"] = "YourSuperSecretKeyWithAtLeast32CharactersLong!123456";

        var action = () => ProductionConfigurationValidator.Validate(
            BuildConfiguration(values),
            BuildEnvironment(Environments.Production));

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*JwtSettings:Secret*giá trị mẫu*");
    }

    [Fact]
    public void Validate_ProductionWithPublicHttpUrlsAndCorsPath_RejectsConfiguration()
    {
        var values = ValidValues();
        values["VNPAY_RETURN_URL"] = "http://www.hrconnectvn.online/payment-return";
        values["MF03_BASE_URL"] = "http://ai.hrconnectvn.online";
        values["Cors:AllowedOrigins:0"] = "https://www.hrconnectvn.online/candidate";

        var action = () => ProductionConfigurationValidator.Validate(
            BuildConfiguration(values),
            BuildEnvironment(Environments.Production));

        var exception = action.Should().Throw<InvalidOperationException>().Which;
        exception.Message.Should().Contain("VNPAY_RETURN_URL");
        exception.Message.Should().Contain("MF03_BASE_URL");
        exception.Message.Should().Contain("Cors:AllowedOrigins");
    }

    [Fact]
    public void Validate_ProductionWithValidConfiguration_Succeeds()
    {
        var action = () => ProductionConfigurationValidator.Validate(
            BuildConfiguration(ValidValues()),
            BuildEnvironment(Environments.Production));

        action.Should().NotThrow();
    }

    private static IConfiguration BuildConfiguration(
        IEnumerable<KeyValuePair<string, string?>> values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();

    private static IHostEnvironment BuildEnvironment(string environmentName)
    {
        var environment = new Mock<IHostEnvironment>();
        environment.SetupGet(value => value.EnvironmentName).Returns(environmentName);
        return environment.Object;
    }

    private static Dictionary<string, string?> ValidValues() => new()
    {
        ["ASPNETCORE_ENVIRONMENT"] = Environments.Production,
        ["ConnectionStrings:DefaultConnection"] =
            "Host=db.internal;Port=5432;Database=hrconnect;Username=app;Password=secret;SSL Mode=Require",
        ["JwtSettings:Secret"] = "a-production-secret-with-more-than-32-bytes-2026",
        ["JwtSettings:Issuer"] = "HRConnect",
        ["JwtSettings:Audience"] = "HRConnectApp",
        ["HRCONNECT_SERVICE_TOKEN"] = "service-token-value",
        ["PUBLIC_API_BASE_URL"] = "https://api.hrconnectvn.online",
        ["SUBMISSION_CONSENT_URL_BASE"] = "https://www.hrconnectvn.online/submission-consent",
        ["VNPAY_TMN_CODE"] = "TESTCODE",
        ["VNPAY_HASH_SECRET"] = "vnpay-signing-secret",
        ["VNPAY_PAYMENT_URL"] = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
        ["VNPAY_RETURN_URL"] = "https://www.hrconnectvn.online/client/billing/vnpay-return",
        ["MF03_BASE_URL"] = "http://ai-v2:8001",
        ["Cors:AllowedOrigins:0"] = "https://www.hrconnectvn.online"
    };
}
