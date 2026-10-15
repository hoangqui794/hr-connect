using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.Templates;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Jobs;

/// <summary>
/// MF-01 JD template library: Clients search and read templates while writing a job; Internal HR and
/// Admin manage the library (permission job_template.manage).
/// </summary>
public static class JobTemplateEndpoints
{
    private const string CreateJobPermission = "job.create";
    private const string ReviewJobPermission = "job.review";
    private const string ManagePermission = JobTemplateConstants.ManagePermission;

    public sealed record UpdateTemplateRequest(Guid ConcurrencyToken, JobTemplateInput Template);

    public static IEndpointRouteBuilder MapJobTemplateEndpoints(this IEndpointRouteBuilder app)
    {
        var library = app.MapGroup("/api/v1/job-templates").WithTags("MF-01 Job Templates").RequireAuthorization();

        library.MapGet("", (ClaimsPrincipal user, [FromServices] ISender sender,
                [FromQuery] string? keyword, [FromQuery] string? industry, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
                Execute(user, [CreateJobPermission, ReviewJobPermission, ManagePermission],
                    _ => sender.Send(new SearchJobTemplatesQuery(keyword, industry, page, pageSize), ct)))
            .WithName("SearchJobTemplates")
            .WithSummary("Tìm mẫu JD theo từ khóa")
            .WithDescription("Tìm không dấu, mọi từ khóa đều phải khớp; khớp tên mẫu lên trước rồi đến mẫu dùng nhiều. keyword rỗng trả các mẫu dùng nhiều nhất. Chỉ mẫu đang hiện. pageSize mặc định/tối đa lấy từ cài đặt mf01.job_template.*.");

        library.MapGet("/{templateId:guid}", (Guid templateId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [CreateJobPermission, ReviewJobPermission, ManagePermission],
                    _ => sender.Send(new GetJobTemplateQuery(templateId, CanSeeInactive(user)), ct)))
            .WithName("GetJobTemplate")
            .WithSummary("Xem đầy đủ một mẫu JD để điền vào form tạo job")
            .WithDescription("Mẫu đã ẩn trả 404 TEMPLATE_NOT_FOUND với Client; Internal HR/Admin vẫn xem được.");

        var manage = app.MapGroup("/api/v1/internal/job-templates").WithTags("MF-01 Job Templates (quản lý)").RequireAuthorization();

        manage.MapGet("", (ClaimsPrincipal user, [FromServices] ISender sender,
                [FromQuery] string? keyword, [FromQuery] string? industry, [FromQuery] bool? isActive,
                [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
                Execute(user, [ManagePermission],
                    _ => sender.Send(new SearchJobTemplatesQuery(keyword, industry, page, pageSize, IncludeInactive: true, IsActive: isActive), ct)))
            .WithName("ManageListJobTemplates")
            .WithSummary("Danh sách mẫu JD, gồm cả mẫu đã ẩn")
            .WithDescription("Lọc isActive=true/false; bỏ trống để lấy tất cả. Quyền job_template.manage.");

        manage.MapGet("/{templateId:guid}", (Guid templateId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ManagePermission],
                    _ => sender.Send(new GetJobTemplateQuery(templateId, CanSeeInactive: true, IncludeConcurrencyToken: true), ct)))
            .WithName("ManageGetJobTemplate")
            .WithSummary("Chi tiết mẫu JD kèm concurrencyToken để sửa");

        manage.MapPost("", (ClaimsPrincipal user, [FromBody] JobTemplateInput body, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ManagePermission], userId => sender.Send(new CreateJobTemplateCommand(body, userId), ct)))
            .WithName("CreateJobTemplate")
            .WithSummary("Tạo mẫu JD")
            .WithDescription("Cần ít nhất 1 yêu cầu MUST_HAVE (TEMPLATE_MUST_HAVE_REQUIRED); code không trùng (TEMPLATE_CODE_DUPLICATE). Yêu cầu category SKILL là kỹ năng.");

        manage.MapPut("/{templateId:guid}", (Guid templateId, ClaimsPrincipal user, [FromBody] UpdateTemplateRequest body, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ManagePermission], userId => sender.Send(
                    new UpdateJobTemplateCommand(templateId, body.ConcurrencyToken, body.Template, userId), ct)))
            .WithName("UpdateJobTemplate")
            .WithSummary("Sửa mẫu JD (ghi đè toàn bộ yêu cầu)")
            .WithDescription("Sai concurrencyToken trả 409. Sửa mẫu không làm đổi các job đã tạo từ mẫu.");

        manage.MapPost("/{templateId:guid}/deactivate", (Guid templateId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ManagePermission], userId => sender.Send(new SetJobTemplateActiveCommand(templateId, false, userId), ct)))
            .WithName("DeactivateJobTemplate")
            .WithSummary("Ẩn mẫu JD (Client không tìm thấy nữa)");

        manage.MapPost("/{templateId:guid}/activate", (Guid templateId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ManagePermission], userId => sender.Send(new SetJobTemplateActiveCommand(templateId, true, userId), ct)))
            .WithName("ActivateJobTemplate")
            .WithSummary("Hiện lại mẫu JD");

        return app;
    }

    private static bool CanSeeInactive(ClaimsPrincipal user) =>
        PermissionAuthorization.HasPermission(user, ManagePermission) || PermissionAuthorization.HasPermission(user, ReviewJobPermission);

    /// <summary>Checks that the caller has any of the permissions, then maps domain exceptions to HTTP results with their error codes.</summary>
    private static async Task<IResult> Execute<T>(ClaimsPrincipal user, string[] anyOf, Func<Guid, Task<T>> action)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(idClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        if (!anyOf.Any(permission => PermissionAuthorization.HasPermission(user, permission)))
        {
            return PermissionAuthorization.Forbidden(string.Join(" | ", anyOf));
        }

        try
        {
            return Results.Ok(new { success = true, data = await action(userId) });
        }
        catch (NotFoundException ex)
        {
            return Results.NotFound(new { success = false, errorCode = JobTemplateConstants.ErrorNotFound, message = ex.Message });
        }
        catch (ForbiddenException ex)
        {
            return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
        }
        catch (ConflictException ex)
        {
            return Results.Conflict(new { success = false, errorCode = ex.ErrorCode, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return Results.BadRequest(new { success = false, errorCode = ex.ErrorCode, message = ex.Message });
        }
    }
}
