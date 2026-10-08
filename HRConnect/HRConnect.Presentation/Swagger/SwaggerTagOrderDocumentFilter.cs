using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Keeps Swagger groups in a stable, actor-oriented order. Tags introduced by
/// future modules are appended alphabetically so they remain visible until the
/// catalog is updated.
/// </summary>
public sealed class SwaggerTagOrderDocumentFilter : IDocumentFilter
{
    private static readonly IReadOnlyList<OpenApiTag> OrderedTags =
    [
        // 01. Authentication and shared resources
        new() { Name = "Auth", Description = "01 · Xác thực — Đăng ký, OTP, đăng nhập, refresh token, đổi hoặc đặt lại mật khẩu và quản lý phiên." },
        new() { Name = "Users", Description = "01 · Dùng chung — Tiện ích cho mọi tài khoản đã đăng nhập, gồm quản lý ảnh đại diện." },

        // 02. Public discovery and master data
        new() { Name = "Service Types", Description = "02 · Danh mục công khai — Loại dịch vụ tuyển dụng và phạm vi vai trò được phép xem hoặc nộp hồ sơ." },
        new() { Name = "Skills", Description = "02 · Danh mục công khai — Tra cứu kỹ năng dùng cho hồ sơ Candidate và yêu cầu công việc." },
        new() { Name = "Jobs", Description = "02 · Việc làm — Tìm kiếm, xem chi tiết, tạo và quản lý Job theo quyền của người dùng." },

        // 03. Candidate journey
        new() { Name = "Candidate Profile", Description = "03 · Candidate — Xem và cập nhật hồ sơ cá nhân." },
        new() { Name = "Candidate Skills", Description = "03 · Candidate — Quản lý danh sách kỹ năng trong hồ sơ ứng viên." },
        new() { Name = "Candidate CV", Description = "03 · Candidate — Quản lý kho CV cá nhân: tải lên, cập nhật, đặt CV chính, tải xuống và xóa." },
        new() { Name = "Candidate Affiliate CVs", Description = "03 · Candidate — Xem CV do Affiliate tải lên, kiểm soát quyền tái sử dụng và nhận CV vào kho cá nhân." },
        new() { Name = "Candidate Identity", Description = "03 · Candidate — Xác minh email cũ để liên kết đúng hồ sơ, CV và lịch sử ứng tuyển." },
        new() { Name = "Candidate Applications", Description = "03 · Candidate — Ứng tuyển trực tiếp, xem lịch sử và chi tiết hồ sơ đã ứng tuyển." },
        new() { Name = "Candidate Submission Consents", Description = "03 · Candidate có tài khoản — Xem và phản hồi yêu cầu Affiliate nộp hồ sơ bằng submissionId và Bearer token." },
        new() { Name = "Submission Consents", Description = "03 · Candidate chưa có tài khoản — Xem và phản hồi yêu cầu Affiliate bằng token một lần nhận qua email." },

        // 04. Affiliate journey
        new() { Name = "Affiliate Profile", Description = "04 · Affiliate — Quản lý hồ sơ, hiệu suất và tài khoản nhận hoa hồng." },
        new() { Name = "Affiliate Candidate Library", Description = "04 · Affiliate — Xem Candidate và CV đã được xác nhận để tái sử dụng đúng phạm vi cho phép." },
        new() { Name = "Affiliate Submissions", Description = "04 · Affiliate — Nộp Candidate/CV vào Job, xem lịch sử và chi tiết lượt nộp." },
        new() { Name = "Affiliate Referral Progress", Description = "04 · Affiliate — Theo dõi tiến độ tuyển dụng của các Candidate do mình giới thiệu." },
        new() { Name = "Affiliate Attributions", Description = "04 · Affiliate — Theo dõi nguồn giới thiệu, lịch sử attribution và quyền lợi liên quan." },

        // 05. Company and recruitment pipeline
        new() { Name = "Company Profile", Description = "05 · Client Company — Xem và cập nhật hồ sơ doanh nghiệp tuyển dụng." },
        new() { Name = "Recruitment", Description = "05 · Tuyển dụng — Sàng lọc, xem chi tiết, lịch sử và xử lý hồ sơ trong pipeline." },
        new() { Name = "Interviews", Description = "05 · Tuyển dụng — Lập lịch, cập nhật và xem kết quả phỏng vấn." },
        new() { Name = "Offers", Description = "05 · Tuyển dụng — Tạo, gửi, xem và phản hồi thư mời nhận việc." },
        new() { Name = "Placements", Description = "05 · Tuyển dụng — Theo dõi tiếp nhận việc, thử việc và bảo hành tuyển dụng." },

        // 06. Internal HR operations
        new() { Name = "Internal HR Profile", Description = "06 · Internal HR — Xem và cập nhật hồ sơ nhân sự nội bộ Agency." },
        new() { Name = "Job Review", Description = "06 · Internal HR — Xem hàng đợi, duyệt hoặc từ chối Job." },
        new() { Name = "Internal HR AI Screening", Description = "06 · Internal HR — Theo dõi trạng thái MF03 và yêu cầu chấm lại hồ sơ bị lỗi." },

        // 07. Platform administration
        new() { Name = "Admin Profile", Description = "07 · Platform Admin — Xem và cập nhật hồ sơ quản trị viên." },
        new() { Name = "Admin Users", Description = "07 · Platform Admin — Tra cứu, tạm khóa, kích hoạt lại và mở khóa đăng nhập cho người dùng." },
        new() { Name = "Admin Approvals", Description = "07 · Platform Admin — Duyệt Affiliate, Client Company và xử lý yêu cầu liên kết danh tính Candidate." },
        new() { Name = "Admin Audit Logs", Description = "07 · Platform Admin — Tra cứu audit log và chi tiết thay đổi nghiệp vụ." },
        new() { Name = "Admin Service Types", Description = "07 · Platform Admin — Quản trị Service Type và cấu hình role được xem hoặc submit." },
        new() { Name = "Admin Commission Rules", Description = "07 · Platform Admin — Quản trị quy tắc, mốc và chính sách hoa hồng Affiliate." },

        // 08. Service-to-service integration
        new() { Name = "Internal AI Integration", Description = "08 · Nội bộ MF03 — API service-to-service để lấy JD và gửi kết quả chấm điểm AI." },
        new() { Name = "Internal APIs - CV Management", Description = "08 · Nội bộ MF03 — Lấy URL tải CV có chữ ký với thời hạn ngắn; dùng X-Service-Token." }
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
