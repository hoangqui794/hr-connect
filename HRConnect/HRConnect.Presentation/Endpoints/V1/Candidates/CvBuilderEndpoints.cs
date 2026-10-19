using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Candidates.CvBuilder;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Candidates;

/// <summary>BE-04 B: CV templates and the build-on-platform / template CV modes (the third mode is upload).</summary>
public static class CvBuilderEndpoints
{
    public sealed record StructuredCvRequest(string Title, Guid? CvTemplateId, StructuredCvContent? StructuredContent, bool IsPrimary = false);

    public static IEndpointRouteBuilder MapCvBuilderEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/cv-templates", (ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, "cv.create", _ => sender.Send(new GetCvTemplatesQuery(), ct)))
            .RequireAuthorization()
            .WithTags("Candidate CV")
            .WithName("GetCvTemplates")
            .WithSummary("Danh sách mẫu CV đang bật")
            .WithDescription("templateConfig cho biết màu nhấn, mật độ chữ và các mục của mẫu. Quyền cv.create.");

        var group = app.MapGroup("/api/v1/candidates/cv/structured").WithTags("Candidate CV").RequireAuthorization();

        group.MapPost("", ([FromBody] StructuredCvRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, "cv.create", userId => sender.Send(
                    new CreateStructuredCvCommand(userId, body.Title, body.CvTemplateId, body.StructuredContent, body.IsPrimary), ct)))
            .WithName("CreateStructuredCv")
            .WithSummary("Tạo CV theo mẫu hoặc dựng trên nền tảng")
            .WithDescription("Có cvTemplateId: TEMPLATE_FORM; không có: PLATFORM_BUILDER (bố cục mặc định). Server render PDF, kiểm tra như CV tải lên, lưu vào kho CV; CV này dùng để ứng tuyển và AI chấm như CV tải lên. structuredContent: fullName (bắt buộc), headline, email, phone, address, summary, experiences[{title, company, startDate, endDate, description}], educations[{school, degree, startDate, endDate, description}], skills[], languages[], certificates[]; cần ít nhất mục tiêu, kinh nghiệm, học vấn hoặc kỹ năng. Quyền cv.create.");

        group.MapGet("/{cvId:guid}", (Guid cvId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, "cv.view_own", userId => sender.Send(new GetStructuredCvQuery(userId, cvId), ct)))
            .WithName("GetStructuredCv")
            .WithSummary("Lấy nội dung CV đã dựng để sửa")
            .WithDescription("Chỉ CV tạo bằng mẫu hoặc trình dựng; CV tải lên trả 400 CV_NOT_STRUCTURED. Quyền cv.view_own.");

        group.MapPut("/{cvId:guid}", (Guid cvId, [FromBody] StructuredCvRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, "cv.update_own", userId => sender.Send(
                    new UpdateStructuredCvCommand(userId, cvId, body.Title, body.CvTemplateId, body.StructuredContent), ct)))
            .WithName("UpdateStructuredCv")
            .WithSummary("Sửa CV đã dựng và render lại PDF")
            .WithDescription("Render file PDF mới; hồ sơ đã nộp trước đó vẫn giữ file cũ. Quyền cv.update_own.");

        return app;
    }

    private static async Task<IResult> Execute<T>(ClaimsPrincipal user, string permission, Func<Guid, Task<T>> action)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(idClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        if (!PermissionAuthorization.HasPermission(user, permission))
        {
            return PermissionAuthorization.Forbidden(permission);
        }

        try
        {
            return Results.Ok(new { success = true, data = await action(userId) });
        }
        catch (NotFoundException ex)
        {
            return Results.NotFound(new { success = false, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return Results.BadRequest(new { success = false, code = ex.ErrorCode, message = ex.Message });
        }
    }
}
