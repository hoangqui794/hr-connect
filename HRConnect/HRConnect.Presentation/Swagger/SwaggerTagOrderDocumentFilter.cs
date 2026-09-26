using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Keeps Swagger groups in a stable business-oriented order. Tags introduced by
/// future modules are appended alphabetically so they remain visible until the
/// catalog is updated.
/// </summary>
public sealed class SwaggerTagOrderDocumentFilter : IDocumentFilter
{
    private static readonly IReadOnlyList<OpenApiTag> OrderedTags =
    [
        new() { Name = "Auth", Description = "Đăng ký, xác thực email, đăng nhập và quản lý phiên người dùng." },
        new() { Name = "Service Types", Description = "Danh mục loại dịch vụ tuyển dụng và phạm vi vai trò được phép xem." },
        new() { Name = "Jobs", Description = "Tạo, quản lý, tìm kiếm và xem chi tiết việc làm." },
        new() { Name = "Users", Description = "Tiện ích dùng chung cho tài khoản người dùng, gồm quản lý ảnh đại diện." },

        new() { Name = "Candidate Profile", Description = "Xem và cập nhật hồ sơ cá nhân của ứng viên." },
        new() { Name = "Candidate CV", Description = "Quản lý kho CV cá nhân: tải lên, xem danh sách, cập nhật, đặt CV chính, tải xuống và xóa." },
        new() { Name = "Candidate Applications", Description = "Ứng tuyển, xem lịch sử và chi tiết hồ sơ ứng tuyển của Candidate." },

        new() { Name = "Affiliate Profile", Description = "Quản lý hồ sơ, hiệu suất và tài khoản nhận hoa hồng của Affiliate Recruiter." },
        new() { Name = "Affiliate Submissions", Description = "Nộp ứng viên, xem lịch sử và chi tiết lượt nộp của Affiliate Recruiter." },
        new() { Name = "Affiliate Attributions", Description = "Theo dõi lịch sử ghi nhận nguồn giới thiệu của Affiliate Recruiter." },

        new() { Name = "Company Profile", Description = "Xem và cập nhật hồ sơ doanh nghiệp tuyển dụng." },

        new() { Name = "Internal HR Profile", Description = "Xem và cập nhật hồ sơ nhân sự nội bộ Agency." },
        new() { Name = "Job Review", Description = "Hàng đợi xét duyệt, duyệt và từ chối việc làm bởi Internal HR." },
        new() { Name = "Internal HR AI Screening", Description = "Theo dõi và yêu cầu AI chấm lại hồ sơ tuyển dụng bị lỗi." },

        new() { Name = "Admin Profile", Description = "Xem và cập nhật hồ sơ Platform Admin." },
        new() { Name = "Admin Approvals", Description = "Xét duyệt tài khoản Affiliate và hồ sơ xác thực doanh nghiệp." },
        new() { Name = "Admin Audit Logs", Description = "Tra cứu lịch sử thao tác nghiệp vụ và chi tiết thay đổi trong hệ thống." },
        new() { Name = "Admin Service Types", Description = "Quản trị loại dịch vụ tuyển dụng và cấu hình vai trò được phép truy cập." },
        new() { Name = "Admin Commission Rules", Description = "Quản trị quy tắc và các mốc hoa hồng của Affiliate." },

        new() { Name = "Internal AI Integration", Description = "API service-to-service để MF03 lấy JD và gửi kết quả chấm điểm AI." },
        new() { Name = "Internal APIs - CV Management", Description = "API service-to-service để MF03 lấy URL tải CV có chữ ký và thời hạn ngắn." }
    ];

    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        var usedTagNames = swaggerDoc.Paths.Values
            .SelectMany(path => path.Operations.Values)
            .SelectMany(operation => operation.Tags)
            .Select(tag => tag.Name)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var orderedTags = OrderedTags
            .Where(tag => usedTagNames.Contains(tag.Name))
            .Select(CloneTag)
            .ToList();

        var catalogTagNames = OrderedTags
            .Select(tag => tag.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        orderedTags.AddRange(usedTagNames
            .Where(name => !catalogTagNames.Contains(name))
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
            .Select(name => new OpenApiTag
            {
                Name = name,
                Description = "Nhóm API chưa được khai báo trong danh mục Swagger."
            }));

        swaggerDoc.Tags = orderedTags;
    }

    private static OpenApiTag CloneTag(OpenApiTag tag) => new()
    {
        Name = tag.Name,
        Description = tag.Description
    };
}
