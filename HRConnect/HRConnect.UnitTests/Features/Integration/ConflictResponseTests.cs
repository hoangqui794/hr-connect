using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Presentation.ErrorHandling;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace HRConnect.UnitTests.Features.Integration;

/// <summary>Test 21/10 (MF05-09e): every 409 must carry the error code so the FE can explain it.</summary>
public class ConflictResponseTests
{
    private static async Task<(int Status, JsonElement Body)> ExecuteAsync(IResult result)
    {
        var context = NewContext();
        await result.ExecuteAsync(context);
        return (context.Response.StatusCode, await ReadBodyAsync(context));
    }

    private static DefaultHttpContext NewContext()
    {
        var services = new ServiceCollection().AddLogging().BuildServiceProvider();
        return new DefaultHttpContext { RequestServices = services, Response = { Body = new MemoryStream() } };
    }

    private static async Task<JsonElement> ReadBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return (await JsonDocument.ParseAsync(context.Response.Body)).RootElement;
    }

    [Fact]
    public async Task From_IncludesCodeUnderBothNames()
    {
        var (status, body) = await ExecuteAsync(ConflictResponse.From(
            new ConflictException("Suất thay thế không còn.", "REPLACEMENT_SLOT_ALREADY_FILLED")));

        status.Should().Be(409);
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("message").GetString().Should().Be("Suất thay thế không còn.");
        body.GetProperty("code").GetString().Should().Be("REPLACEMENT_SLOT_ALREADY_FILLED");
        body.GetProperty("errorCode").GetString().Should().Be("REPLACEMENT_SLOT_ALREADY_FILLED");
    }

    [Fact]
    public async Task From_KeepsClientSafeDetails()
    {
        var details = new Dictionary<string, object?> { ["slotId"] = "s-1" };
        var (_, body) = await ExecuteAsync(ConflictResponse.From(new ConflictException("x", "CODE", details)));

        body.GetProperty("details").GetProperty("slotId").GetString().Should().Be("s-1");
    }

    [Fact]
    public async Task UncaughtConflict_IsA409WithCode_NotA500()
    {
        var context = NewContext();

        var handled = await new ConflictExceptionHandler().TryHandleAsync(
            context, new ConflictException("Đã có người sửa trước.", "CONCURRENCY_CONFLICT"), default);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(409);
        (await ReadBodyAsync(context)).GetProperty("code").GetString().Should().Be("CONCURRENCY_CONFLICT");
    }

    [Fact]
    public async Task OtherExceptions_AreLeftAlone()
    {
        var handled = await new ConflictExceptionHandler().TryHandleAsync(NewContext(), new InvalidOperationException(), default);

        handled.Should().BeFalse();
    }
}
