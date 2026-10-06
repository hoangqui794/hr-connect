using System.Security.Claims;
using FluentAssertions;
using HRConnect.Infrastructure.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Filters;

public class InternalServiceAuthFilterTests
{
    private const string ValidToken = "valid_test_service_token_123456789";
    private readonly Mock<ILogger<InternalServiceAuthFilter>> _loggerMock = new();

    private IConfiguration CreateConfiguration(string? token = ValidToken)
    {
        var dict = new Dictionary<string, string?>();
        if (token != null)
        {
            dict["HRCONNECT_SERVICE_TOKEN"] = token;
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(dict)
            .Build();
    }

    private static (DefaultHttpContext HttpContext, EndpointFilterInvocationContext Context) CreateFilterContext()
    {
        var httpContext = new DefaultHttpContext();
        var mockFilterContext = new Mock<EndpointFilterInvocationContext>();
        mockFilterContext.Setup(c => c.HttpContext).Returns(httpContext);
        return (httpContext, mockFilterContext.Object);
    }

    [Fact]
    public async Task InvokeAsync_WhenMissingTokenHeader_Returns401Unauthorized()
    {
        // Arrange
        var config = CreateConfiguration();
        var filter = new InternalServiceAuthFilter(config, _loggerMock.Object);
        var (httpContext, context) = CreateFilterContext();

        var nextCalled = false;
        EndpointFilterDelegate next = _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>(Results.Ok());
        };

        // Act
        var result = await filter.InvokeAsync(context, next);

        // Assert
        nextCalled.Should().BeFalse();
        var jsonResult = result.As<Microsoft.AspNetCore.Http.IStatusCodeHttpResult>();
        jsonResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task InvokeAsync_WhenTokenIsInvalid_Returns403Forbidden()
    {
        // Arrange
        var config = CreateConfiguration();
        var filter = new InternalServiceAuthFilter(config, _loggerMock.Object);
        var (httpContext, context) = CreateFilterContext();
        httpContext.Request.Headers["X-Service-Token"] = "invalid_token_xyz";

        var nextCalled = false;
        EndpointFilterDelegate next = _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>(Results.Ok());
        };

        // Act
        var result = await filter.InvokeAsync(context, next);

        // Assert
        nextCalled.Should().BeFalse();
        var jsonResult = result.As<Microsoft.AspNetCore.Http.IStatusCodeHttpResult>();
        jsonResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task InvokeAsync_WhenValidTokenInXServiceToken_CallsNext()
    {
        // Arrange
        var config = CreateConfiguration();
        var filter = new InternalServiceAuthFilter(config, _loggerMock.Object);
        var (httpContext, context) = CreateFilterContext();
        httpContext.Request.Headers["X-Service-Token"] = ValidToken;

        var nextCalled = false;
        EndpointFilterDelegate next = _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>(Results.Ok("success"));
        };

        // Act
        var result = await filter.InvokeAsync(context, next);

        // Assert
        nextCalled.Should().BeTrue();
    }

    [Fact]
    public async Task InvokeAsync_WhenValidTokenInBearerAuthHeader_CallsNext()
    {
        // Arrange
        var config = CreateConfiguration();
        var filter = new InternalServiceAuthFilter(config, _loggerMock.Object);
        var (httpContext, context) = CreateFilterContext();
        httpContext.Request.Headers["Authorization"] = $"Bearer {ValidToken}";

        var nextCalled = false;
        EndpointFilterDelegate next = _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>(Results.Ok("success"));
        };

        // Act
        var result = await filter.InvokeAsync(context, next);

        // Assert
        nextCalled.Should().BeTrue();
    }
}
