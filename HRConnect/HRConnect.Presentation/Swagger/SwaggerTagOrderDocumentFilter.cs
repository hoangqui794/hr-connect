using System.Collections.Generic;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Configures the deterministic business-oriented Swagger tag display order:
/// 1. Auth
/// 2. Jobs
/// 3. Service Types
/// 4. Candidate Profile
/// 5. Candidate CV
/// 6. Candidate Applications
/// 7. Affiliate Profile
/// 8. Affiliate Submissions
/// 9. Affiliate Attributions
/// 10. Company Profile
/// 11. Internal HR Profile
/// 12. Job Review
/// 13. Admin Approvals
/// 14. Admin Service Types
/// 15. Internal AI Integration
/// 16. Internal APIs - CV Management
/// </summary>
public class SwaggerTagOrderDocumentFilter : IDocumentFilter
{
    private static readonly List<OpenApiTag> OrderedTags = new()
    {
        new() { Name = "Auth", Description = "Xác thực và quản lý tài khoản người dùng" },
        new() { Name = "Jobs", Description = "Quản lý bài đăng tuyển dụng doanh nghiệp và tìm kiếm việc làm" },
        new() { Name = "Service Types", Description = "Danh mục loại dịch vụ tuyển dụng công khai" },
        new() { Name = "Candidate Profile", Description = "Hồ sơ cá nhân của ứng viên" },
        new() { Name = "Candidate CV", Description = "Kho CV cá nhân và quản lý tệp CV ứng viên (Tải lên, Danh sách, Cập nhật, Đặt CV chính, Xóa, Tải xuống qua Cloudflare R2)" },
        new() { Name = "Candidate Applications", Description = "Lịch sử và chi tiết hồ sơ ứng tuyển của ứng viên" },
        new() { Name = "Affiliate Profile", Description = "Hồ sơ đối tác tuyển dụng (Affiliate Recruiter, Hiệu suất, Tài khoản ngân hàng)" },
        new() { Name = "Affiliate Submissions", Description = "Lịch sử và chi tiết nộp hồ sơ ứng viên của Affiliate" },
        new() { Name = "Affiliate Attributions", Description = "Ghi nhận nguồn giới thiệu thành công của Affiliate" },
        new() { Name = "Company Profile", Description = "Hồ sơ doanh nghiệp tuyển dụng" },
        new() { Name = "Internal HR Profile", Description = "Hồ sơ nhân sự nội bộ Agency" },
        new() { Name = "Job Review", Description = "Hàng đợi và xét duyệt tin tuyển dụng bởi Internal HR" },
        new() { Name = "Admin Approvals", Description = "Xét duyệt hồ sơ Affiliate và xác thực doanh nghiệp bởi Platform Admin" },
        new() { Name = "Admin Service Types", Description = "Quản trị danh mục loại dịch vụ tuyển dụng bởi Platform Admin" },
        new() { Name = "Internal AI Integration", Description = "Tích hợp dịch vụ AI nội bộ (MF-03 JD Fetching & Match Result Callback)" },
        new() { Name = "Internal APIs - CV Management", Description = "API nội bộ quản lý tệp CV và tạo Presigned URL cho dịch vụ AI" }
    };

    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        swaggerDoc.Tags = OrderedTags;
    }
}
