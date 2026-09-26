using FluentAssertions;
using HRConnect.Presentation.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Middleware;

public class RequestLoggingMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_WhenHeaderIsMissing_GeneratesCorrelationIdAndReturnsIt()
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/api/v1/test";
        var middleware = CreateMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        Guid.TryParse(context.Response.Headers[RequestLoggingMiddleware.CorrelationHeaderName], out var correlationId)
            .Should().BeTrue();
        correlationId.Should().NotBeEmpty();
        context.TraceIdentifier.Should().Be(correlationId.ToString());
        context.Items[RequestLoggingMiddleware.CorrelationItemKey].Should().Be(correlationId);
    }

    [Fact]
    public async Task InvokeAsync_WhenHeaderContainsValidGuid_PreservesIt()
    {
        var expected = Guid.NewGuid();
        var context = new DefaultHttpContext();
        context.Request.Headers[RequestLoggingMiddleware.CorrelationHeaderName] = expected.ToString();
        var middleware = CreateMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        context.Response.Headers[RequestLoggingMiddleware.CorrelationHeaderName]
            .ToString().Should().Be(expected.ToString());
        context.Items[RequestLoggingMiddleware.CorrelationItemKey].Should().Be(expected);
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task InvokeAsync_WhenHeaderIsInvalid_ReplacesIt(string invalidValue)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[RequestLoggingMiddleware.CorrelationHeaderName] = invalidValue;
        var middleware = CreateMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        var returned = context.Response.Headers[RequestLoggingMiddleware.CorrelationHeaderName].ToString();
        returned.Should().NotBe(invalidValue);
        Guid.TryParse(returned, out var parsed).Should().BeTrue();
        parsed.Should().NotBeEmpty();
    }

    [Fact]
    public async Task InvokeAsync_UsesFinalResponseStatusCode()
    {
        var context = new DefaultHttpContext();
        var middleware = CreateMiddleware(httpContext =>
        {
            httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);
    }

    private static RequestLoggingMiddleware CreateMiddleware(RequestDelegate next) =>
        new(next, Mock.Of<ILogger<RequestLoggingMiddleware>>());
}
