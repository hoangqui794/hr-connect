using FluentAssertions;
using HRConnect.Presentation.ErrorHandling;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace HRConnect.UnitTests.Features.Integration;

/// <summary>BUG-02 (test 20/10): a missing required query parameter must be 400, not 500.</summary>
public class BadHttpRequestExceptionHandlerTests
{
    [Fact]
    public async Task MissingParameter_ShouldBe400()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var handled = await new BadHttpRequestExceptionHandler().TryHandleAsync(
            context, new BadHttpRequestException("Required parameter \"Guid concurrencyToken\" was not provided from query string."), default);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task OtherExceptions_ShouldBeLeftAlone()
    {
        var handled = await new BadHttpRequestExceptionHandler().TryHandleAsync(new DefaultHttpContext(), new InvalidOperationException(), default);

        handled.Should().BeFalse();
    }
}
