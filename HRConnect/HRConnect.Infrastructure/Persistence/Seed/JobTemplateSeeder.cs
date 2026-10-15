using HRConnect.Application.Features.Jobs.Templates;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

/// <summary>
/// MF-01: starter JD templates for common roles. Idempotent by code: an existing template (possibly
/// edited by Internal HR) is never overwritten. Requirements are one measurable idea each so AI CV
/// scoring can judge them; years go in EXPERIENCE, skill tags in SKILL.
/// </summary>
public static class JobTemplateSeeder
{
    private const string Must = "MUST_HAVE";
    private const string Should = "SHOULD_HAVE";

    public sealed record SeedRequirement(string Type, string Category, string Content);

    public sealed record SeedTemplate(
        string Code, string Name, string Industry, string Level, string Keywords, string Summary,
        string Title, string Description, string Benefits, int? MinYears, int? MaxYears,
        SeedRequirement[] Requirements);

    private const string OfficeBenefits =
        "• Lương tháng 13 và thưởng theo hiệu quả công việc\n• Đóng đầy đủ BHXH, BHYT, BHTN theo quy định\n• 12 ngày phép năm, khám sức khỏe định kỳ\n• Môi trường làm việc chuyên nghiệp, có lộ trình phát triển rõ ràng";

    private const string TechBenefits =
        "• Lương cạnh tranh, review lương định kỳ\n• Lương tháng 13 và thưởng dự án\n• Bảo hiểm sức khỏe, đóng BHXH đầy đủ\n• Được cấp thiết bị làm việc, hỗ trợ chi phí học chứng chỉ";

    public static readonly SeedTemplate[] Templates =
    [
        new("IT_BACKEND_DOTNET", "Lập trình viên Backend .NET", "IT", "MIDDLE",
            "dotnet, .net, c#, asp.net core, backend, api, sql server, entity framework",
            "Xây dựng API ASP.NET Core, làm việc với SQL Server và các dịch vụ backend.",
            "Lập trình viên Backend .NET (Middle)",
            "• Thiết kế và phát triển RESTful API bằng ASP.NET Core\n• Thiết kế cơ sở dữ liệu, viết truy vấn và tối ưu hiệu năng SQL\n• Viết unit test, tham gia code review\n• Phối hợp với Frontend, QA và BA để hoàn thành tính năng đúng hạn",
            TechBenefits, 2, 5,
            [
                new(Must, "EXPERIENCE", "Ít nhất 2 năm kinh nghiệm lập trình C# và ASP.NET Core"),
                new(Must, "SKILL", "Xây dựng RESTful API"),
                new(Must, "SKILL", "SQL Server hoặc PostgreSQL"),
                new(Must, "SKILL", "Entity Framework Core"),
                new(Should, "SKILL", "Docker"),
                new(Should, "SKILL", "Redis hoặc RabbitMQ"),
                new(Should, "OTHER", "Hiểu Clean Architecture hoặc các design pattern phổ biến"),
            ]),
        new("IT_FRONTEND_REACT", "Lập trình viên Frontend ReactJS", "IT", "MIDDLE",
            "react, reactjs, frontend, typescript, javascript, html, css, front-end",
            "Phát triển giao diện web bằng ReactJS và TypeScript, kết nối API backend.",
            "Lập trình viên Frontend ReactJS (Middle)",
            "• Xây dựng giao diện web bằng ReactJS và TypeScript theo thiết kế\n• Kết nối RESTful API, quản lý trạng thái ứng dụng\n• Tối ưu hiệu năng tải trang và trải nghiệm trên thiết bị di động\n• Viết test cho component, tham gia code review",
            TechBenefits, 2, 5,
            [
                new(Must, "EXPERIENCE", "Ít nhất 2 năm kinh nghiệm phát triển frontend với ReactJS"),
                new(Must, "SKILL", "TypeScript"),
                new(Must, "SKILL", "HTML và CSS responsive"),
                new(Must, "OTHER", "Kết nối RESTful API và xử lý lỗi phía giao diện"),
                new(Should, "SKILL", "Redux, Zustand hoặc React Query"),
                new(Should, "SKILL", "Tailwind CSS hoặc Ant Design"),
                new(Should, "OTHER", "Viết test bằng Jest, Vitest hoặc Testing Library"),
            ]),
        new("IT_FULLSTACK", "Lập trình viên Fullstack", "IT", "MIDDLE",
            "fullstack, full-stack, react, node, .net, api, frontend, backend",
            "Phát triển cả giao diện web và API backend cho sản phẩm.",
            "Lập trình viên Fullstack (Middle)",
            "• Phát triển tính năng trọn vẹn từ giao diện đến API và cơ sở dữ liệu\n• Thiết kế API, mô hình dữ liệu và luồng xử lý\n• Đảm bảo chất lượng bằng test và code review\n• Tham gia triển khai và theo dõi sản phẩm sau khi phát hành",
            TechBenefits, 3, 6,
            [
                new(Must, "EXPERIENCE", "Ít nhất 3 năm kinh nghiệm phát triển phần mềm web"),
                new(Must, "SKILL", "ReactJS hoặc Angular"),
                new(Must, "SKILL", "ASP.NET Core hoặc Node.js"),
                new(Must, "SKILL", "Cơ sở dữ liệu quan hệ (SQL Server, PostgreSQL hoặc MySQL)"),
                new(Should, "SKILL", "Docker"),
                new(Should, "OTHER", "Kinh nghiệm triển khai lên cloud (AWS, Azure hoặc GCP)"),
            ]),
        new("IT_QA_TESTER", "Kiểm thử phần mềm (QA/Tester)", "IT", "JUNIOR",
            "qa, qc, tester, kiem thu, test, manual test, automation test",
            "Lập kế hoạch và thực hiện kiểm thử, báo lỗi và theo dõi chất lượng sản phẩm.",
            "Chuyên viên Kiểm thử phần mềm (QA/Tester)",
            "• Phân tích yêu cầu, viết test case và test plan\n• Thực hiện kiểm thử chức năng, hồi quy trên web và mobile\n• Báo lỗi rõ ràng, theo dõi đến khi được sửa\n• Phối hợp với lập trình viên để đảm bảo chất lượng bản phát hành",
            TechBenefits, 1, 3,
            [
                new(Must, "EXPERIENCE", "Ít nhất 1 năm kinh nghiệm kiểm thử phần mềm"),
                new(Must, "OTHER", "Viết test case và báo lỗi theo quy trình"),
                new(Must, "SKILL", "Sử dụng Jira hoặc công cụ quản lý lỗi tương đương"),
                new(Should, "SKILL", "Kiểm thử API bằng Postman"),
                new(Should, "SKILL", "Selenium, Playwright hoặc Cypress"),
                new(Should, "SKILL", "Viết truy vấn SQL cơ bản để kiểm tra dữ liệu"),
            ]),
        new("IT_DATA_ANALYST", "Chuyên viên phân tích dữ liệu", "IT", "MIDDLE",
            "data analyst, phan tich du lieu, sql, power bi, excel, bao cao, dashboard",
            "Thu thập, phân tích dữ liệu và xây dựng báo cáo hỗ trợ ra quyết định.",
            "Chuyên viên Phân tích dữ liệu (Data Analyst)",
            "• Thu thập, làm sạch và phân tích dữ liệu kinh doanh\n• Xây dựng dashboard và báo cáo định kỳ\n• Trình bày kết quả phân tích, đề xuất hành động cho các phòng ban\n• Phối hợp xác định chỉ số đo lường (KPI)",
            TechBenefits, 2, 5,
            [
                new(Must, "EXPERIENCE", "Ít nhất 2 năm kinh nghiệm phân tích dữ liệu"),
                new(Must, "SKILL", "SQL"),
                new(Must, "SKILL", "Power BI, Tableau hoặc Looker Studio"),
                new(Must, "SKILL", "Excel nâng cao (Pivot, hàm tra cứu)"),
                new(Should, "SKILL", "Python (pandas)"),
                new(Should, "OTHER", "Hiểu các chỉ số kinh doanh, marketing hoặc vận hành"),
            ]),
        new("MKT_CONTENT", "Chuyên viên Content Marketing", "MARKETING", "JUNIOR",
            "content, content marketing, copywriter, viet bai, social, seo content",
            "Lên kế hoạch và sản xuất nội dung cho website, mạng xã hội và chiến dịch.",
            "Chuyên viên Content Marketing",
            "• Lên kế hoạch nội dung theo tháng cho website và mạng xã hội\n• Viết bài, kịch bản video ngắn, nội dung quảng cáo\n• Phối hợp với thiết kế để sản xuất hình ảnh, video\n• Theo dõi tương tác và tối ưu nội dung theo số liệu",
            OfficeBenefits, 1, 3,
            [
                new(Must, "EXPERIENCE", "Ít nhất 1 năm kinh nghiệm viết nội dung marketing"),
                new(Must, "OTHER", "Lập kế hoạch nội dung (content calendar)"),
                new(Must, "OTHER", "Viết bài cho Facebook, TikTok hoặc website"),
                new(Should, "SKILL", "Canva hoặc CapCut"),
                new(Should, "SKILL", "Viết bài chuẩn SEO"),
                new(Should, "OTHER", "Theo dõi số liệu tương tác (reach, engagement)"),
            ]),
        new("MKT_DIGITAL", "Chuyên viên Digital / Performance Marketing", "MARKETING", "MIDDLE",
            "digital marketing, performance, ads, facebook ads, google ads, tiktok ads, ga4, quang cao",
            "Triển khai và tối ưu quảng cáo trả phí trên Meta, Google, TikTok.",
            "Chuyên viên Digital / Performance Marketing",
            "• Lập kế hoạch và chạy quảng cáo trên Meta, Google, TikTok\n• Tối ưu ngân sách theo CPA, ROAS, tỷ lệ chuyển đổi\n• Thiết lập tracking (Pixel, GA4, GTM) và báo cáo hiệu quả\n• Thử nghiệm A/B nội dung quảng cáo và trang đích",
            OfficeBenefits, 2, 5,
            [
                new(Must, "EXPERIENCE", "Ít nhất 2 năm kinh nghiệm chạy quảng cáo trả phí"),
                new(Must, "SKILL", "Facebook Ads (Meta Ads)"),
                new(Must, "SKILL", "Google Ads"),
                new(Must, "OTHER", "Tối ưu chiến dịch theo CPA, ROAS hoặc tỷ lệ chuyển đổi"),
                new(Should, "SKILL", "GA4 và Google Tag Manager"),
                new(Should, "SKILL", "TikTok Ads"),
            ]),
        new("MKT_MARCOM", "Chuyên viên Marketing & Communication", "MARKETING", "MIDDLE",
            "marcom, marketing communication, truyen thong, branding, social media, pr",
            "Quản lý truyền thông thương hiệu trên mạng xã hội, website và ấn phẩm.",
            "Chuyên viên Marketing & Communication",
            "• Lên kế hoạch truyền thông, giữ thông điệp và nhận diện thương hiệu nhất quán\n• Quản lý mạng xã hội và nội dung website\n• Thiết kế ấn phẩm, hồ sơ năng lực, tài liệu giới thiệu\n• Phối hợp các phòng ban và đối tác bên ngoài để triển khai chiến dịch",
            OfficeBenefits, 3, 6,
            [
                new(Must, "EXPERIENCE", "Ít nhất 3 năm kinh nghiệm Marketing Communication hoặc Content"),
                new(Must, "SKILL", "Thiết kế bằng Photoshop, Illustrator hoặc Canva"),
                new(Must, "OTHER", "Quản lý kênh mạng xã hội và nội dung website"),
                new(Should, "OTHER", "Kiến thức SEO, quảng cáo trả phí và đo lường"),
                new(Should, "OTHER", "Sản xuất ảnh và video ngắn"),
                new(Should, "OTHER", "Ứng dụng công cụ AI trong sản xuất nội dung"),
            ]),
        new("SALES_B2B", "Nhân viên kinh doanh B2B", "SALES", "JUNIOR",
            "sales, kinh doanh, b2b, ban hang, tu van, khach hang doanh nghiep",
            "Tìm kiếm và chăm sóc khách hàng doanh nghiệp, đạt chỉ tiêu doanh số.",
            "Nhân viên Kinh doanh B2B",
            "• Tìm kiếm khách hàng doanh nghiệp tiềm năng\n• Tư vấn giải pháp, đàm phán báo giá và hợp đồng\n• Chăm sóc khách hàng hiện tại, khai thác nhu cầu mới\n• Báo cáo doanh số và tiến độ theo tuần",
            OfficeBenefits, 1, 4,
            [
                new(Must, "EXPERIENCE", "Ít nhất 1 năm kinh nghiệm kinh doanh B2B"),
                new(Must, "OTHER", "Đạt chỉ tiêu doanh số theo tháng hoặc quý"),
                new(Must, "OTHER", "Kỹ năng đàm phán và thuyết trình với khách hàng"),
                new(Should, "SKILL", "Sử dụng CRM (Salesforce, HubSpot hoặc tương đương)"),
                new(Should, "OTHER", "Tiếng Anh giao tiếp"),
            ]),
        new("SALES_CS", "Nhân viên chăm sóc khách hàng", "SALES", "JUNIOR",
            "cskh, cham soc khach hang, customer service, tong dai, ho tro khach hang",
            "Tiếp nhận, giải đáp yêu cầu và xử lý khiếu nại của khách hàng.",
            "Nhân viên Chăm sóc khách hàng",
            "• Tiếp nhận và giải đáp yêu cầu qua điện thoại, email, chat\n• Xử lý khiếu nại, phối hợp bộ phận liên quan để giải quyết\n• Ghi nhận thông tin khách hàng vào hệ thống\n• Đề xuất cải thiện quy trình phục vụ",
            OfficeBenefits, 0, 2,
            [
                new(Must, "OTHER", "Giao tiếp rõ ràng qua điện thoại và văn bản"),
                new(Must, "OTHER", "Xử lý khiếu nại của khách hàng"),
                new(Must, "SKILL", "Tin học văn phòng"),
                new(Should, "EXPERIENCE", "Ít nhất 6 tháng kinh nghiệm chăm sóc khách hàng"),
                new(Should, "SKILL", "Sử dụng CRM hoặc phần mềm ticket"),
            ]),
        new("ACC_GENERAL", "Kế toán tổng hợp", "ACCOUNTING", "MIDDLE",
            "ke toan, ke toan tong hop, accountant, thue, bao cao tai chinh, misa",
            "Hạch toán, lập báo cáo thuế và báo cáo tài chính của doanh nghiệp.",
            "Kế toán Tổng hợp",
            "• Kiểm tra, hạch toán nghiệp vụ kế toán phát sinh\n• Lập tờ khai thuế GTGT, TNCN, TNDN và báo cáo tài chính\n• Đối chiếu công nợ, kiểm soát chứng từ\n• Làm việc với cơ quan thuế và kiểm toán",
            OfficeBenefits, 3, 6,
            [
                new(Must, "EXPERIENCE", "Ít nhất 3 năm kinh nghiệm kế toán tổng hợp"),
                new(Must, "EDUCATION", "Tốt nghiệp Đại học chuyên ngành Kế toán hoặc Tài chính"),
                new(Must, "OTHER", "Lập báo cáo thuế và báo cáo tài chính"),
                new(Must, "SKILL", "Phần mềm kế toán MISA, Fast hoặc tương đương"),
                new(Should, "SKILL", "Excel nâng cao"),
                new(Should, "OTHER", "Chứng chỉ kế toán trưởng"),
            ]),
        new("HR_RECRUITER", "Chuyên viên tuyển dụng", "HR", "JUNIOR",
            "tuyen dung, recruiter, talent acquisition, nhan su, phong van, hr",
            "Tìm nguồn, sàng lọc và phỏng vấn ứng viên theo nhu cầu các phòng ban.",
            "Chuyên viên Tuyển dụng",
            "• Tiếp nhận nhu cầu tuyển dụng, viết và đăng tin\n• Tìm nguồn ứng viên, sàng lọc CV, sắp xếp phỏng vấn\n• Phỏng vấn sơ bộ và phối hợp với quản lý trực tiếp\n• Theo dõi báo cáo tuyển dụng và trải nghiệm ứng viên",
            OfficeBenefits, 1, 3,
            [
                new(Must, "EXPERIENCE", "Ít nhất 1 năm kinh nghiệm tuyển dụng"),
                new(Must, "OTHER", "Sàng lọc CV và phỏng vấn sơ bộ"),
                new(Must, "OTHER", "Tìm nguồn ứng viên qua LinkedIn, TopCV hoặc mạng xã hội"),
                new(Should, "OTHER", "Kinh nghiệm tuyển dụng vị trí IT"),
                new(Should, "OTHER", "Tiếng Anh đọc hiểu"),
            ]),
        new("ADMIN_OFFICE", "Nhân viên hành chính văn phòng", "ADMIN", "JUNIOR",
            "hanh chinh, van phong, admin, le tan, van thu, hanh chinh nhan su",
            "Quản lý giấy tờ, văn phòng phẩm, hỗ trợ công việc hành chính hằng ngày.",
            "Nhân viên Hành chính văn phòng",
            "• Quản lý hồ sơ, văn bản đi và đến\n• Theo dõi văn phòng phẩm, tài sản và thiết bị văn phòng\n• Hỗ trợ tổ chức họp, sự kiện nội bộ\n• Đón tiếp khách và hỗ trợ các phòng ban",
            OfficeBenefits, 0, 2,
            [
                new(Must, "SKILL", "Tin học văn phòng (Word, Excel)"),
                new(Must, "OTHER", "Quản lý hồ sơ, văn bản"),
                new(Must, "OTHER", "Giao tiếp và sắp xếp công việc"),
                new(Should, "EXPERIENCE", "Ít nhất 6 tháng kinh nghiệm hành chính"),
                new(Should, "OTHER", "Tiếng Anh giao tiếp cơ bản"),
            ]),
    ];

    public static async Task SeedAsync(ApplicationDbContext context, ILogger? logger = null, CancellationToken cancellationToken = default)
    {
        var codes = Templates.Select(t => t.Code).ToList();
        var existing = await context.JobTemplates.Where(t => codes.Contains(t.Code)).Select(t => t.Code).ToListAsync(cancellationToken);
        var missing = Templates.Where(t => !existing.Contains(t.Code)).ToList();
        if (missing.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var seed in missing)
        {
            var template = new JobTemplate
            {
                TemplateId = Guid.NewGuid(),
                IsActive = true,
                ConcurrencyToken = Guid.NewGuid(),
                CreatedAt = now,
                UpdatedAt = now,
            };
            JobTemplateMapping.Apply(template, new JobTemplateInput(
                seed.Code, seed.Name, seed.Industry, seed.Level, seed.Keywords, seed.Summary,
                seed.Title, seed.Description, seed.Benefits, "FULL_TIME", seed.MinYears, seed.MaxYears,
                seed.Requirements.Select(r => new JobTemplateRequirementInput(r.Type, r.Category, r.Content)).ToList()));
            await context.JobTemplates.AddAsync(template, cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);
        logger?.LogInformation("Seeded {Count} MF-01 job templates.", missing.Count);
    }
}
