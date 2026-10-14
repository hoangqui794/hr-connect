using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Commands.ApproveJob;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Commands.SubmitJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Jobs.Queries.GetJobCommercialTermsDefaults;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

public class RealDatabaseMf01IntegrationTests
{
    private static string GetConnectionString()
    {
        // Ưu tiên đọc từ biến môi trường hoặc file .env của dự án
        var envPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "HRConnect", ".env");
        if (File.Exists(envPath))
        {
            foreach (var line in File.ReadAllLines(envPath))
            {
                if (line.StartsWith("ConnectionStrings__DefaultConnection=", StringComparison.OrdinalIgnoreCase))
                {
                    return line.Substring("ConnectionStrings__DefaultConnection=".Length).Trim();
                }
            }
        }

        var envVar = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (!string.IsNullOrWhiteSpace(envVar)) return envVar;

        return "Host=localhost;Port=5432;Database=HRConnect;Username=postgres;Password=12345;SearchPath=public";
    }

    private static ApplicationDbContext CreateRealDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(GetConnectionString())
            .EnableSensitiveDataLogging()
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task CompleteCommercialTermsLifecycle_TestedDirectlyAgainstPostgreSqlDatabase()
    {
        var connStr = GetConnectionString();
        using var testDb = CreateRealDbContext();

        // 1. Kiểm tra kết nối tới Database Postgres thực tế (nếu trên CI không có Postgres thì bỏ qua)
        var canConnect = await testDb.Database.CanConnectAsync();
        if (!canConnect)
        {
            return;
        }

        // 2. Tìm hoặc chuẩn bị dữ liệu thực tế từ Database
        var serviceType = await testDb.ServiceTypes.FirstOrDefaultAsync(s => s.Code == "CV_SOURCING");
        if (serviceType == null)
        {
            serviceType = new ServiceType
            {
                ServiceTypeId = Guid.NewGuid(),
                Code = "CV_SOURCING",
                Name = "CV Sourcing",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            testDb.ServiceTypes.Add(serviceType);
            await testDb.SaveChangesAsync();
        }

        var company = await testDb.Companies.FirstOrDefaultAsync(c => c.VerificationStatus == "VERIFIED")
                      ?? await testDb.Companies.FirstOrDefaultAsync();

        if (company == null)
        {
            company = new Company
            {
                CompanyId = Guid.NewGuid(),
                CompanyName = "FPT Software Test Client",
                VerificationStatus = "VERIFIED",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            testDb.Companies.Add(company);
            await testDb.SaveChangesAsync();
        }
        else if (company.VerificationStatus != "VERIFIED")
        {
            company.VerificationStatus = "VERIFIED";
            await testDb.SaveChangesAsync();
        }

        var clientUser = await testDb.CompanyUsers.Include(cu => cu.User).FirstOrDefaultAsync(cu => cu.CompanyId == company.CompanyId && cu.Status == "ACTIVE");
        if (clientUser == null)
        {
            var user = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = $"test_client_{Guid.NewGuid():N}@fpt.com",
                DisplayName = "FPT Client HR Lead",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            testDb.AppUsers.Add(user);
            clientUser = new CompanyUser
            {
                CompanyId = company.CompanyId,
                UserId = user.UserId,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            testDb.CompanyUsers.Add(clientUser);
            await testDb.SaveChangesAsync();
        }

        var hrAdminUser = await testDb.AppUsers.FirstOrDefaultAsync(u => u.Email.Contains("admin") || u.Email.Contains("hr"));
        if (hrAdminUser == null)
        {
            hrAdminUser = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = "internal.hr.reviewer@hrconnect.vn",
                DisplayName = "HR Connect Reviewer Lead",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            testDb.AppUsers.Add(hrAdminUser);
            await testDb.SaveChangesAsync();
        }

        Guid createdJobId = Guid.Empty;

        try
        {
            // =========================================================================
            // GIAI ĐOẠN A2: TẠO JOB THỰC TẾ TRONG DATABASE VỚI PROPOSED TERMS
            // =========================================================================
            using (var dbForCreate = CreateRealDbContext())
            {
                var jobRepo = new JobRepository(dbForCreate);
                var memberRepo = new CompanyUserRepository(dbForCreate);
                var uow = new UnitOfWork(dbForCreate);
                var logger = Mock.Of<ILogger<CreateJobCommandHandler>>();

                var createHandler = new CreateJobCommandHandler(memberRepo, jobRepo, uow, logger);

                var createCommand = new CreateJobCommand
                {
                    UserId = clientUser.UserId,
                    ServiceTypeId = serviceType.ServiceTypeId,
                    Title = "Kỹ sư .NET Core Senior (Real DB Integration Test)",
                    Description = "Mô tả công việc thực tế được ghi vào PostgreSQL database.",
                    Benefits = "Macbook Pro M3, gói bảo hiểm sức khỏe cao cấp, thưởng KPI",
                    WorkingTime = "Thứ 2 - Thứ 6 (08:30 - 17:30)",
                    Location = "Tòa nhà FPT Cầu Giấy, Hà Nội",
                    EmploymentType = "FULL_TIME",
                    CurrencyCode = "VND",
                    Quantity = 2,
                    Visibility = "PARTNER_ONLY",
                    SourcingTarget = 5,
                    ProposedTerms = new JobProposedTermsRequest(
                        FeeMultiplier: null,
                        WarrantyDays: null,
                        PaymentDueDays: 15,
                        PricePerCv: 450_000m,
                        Note: "Doanh nghiệp FPT đề xuất 450.000 VNĐ/CV theo thỏa thuận khung."),
                    Requirements =
                    [
                        new CreateJobRequirementRequest
                        {
                            RequirementType = "must_have",
                            Category = "Kỹ thuật",
                            Content = "Tối thiểu 3 năm kinh nghiệm với ASP.NET Core & PostgreSQL"
                        }
                    ]
                };

                var createResponse = await createHandler.Handle(createCommand, CancellationToken.None);
                createResponse.Success.Should().BeTrue();
                createdJobId = createResponse.Data.JobId;
            }

            // TRUY VẤN TRỰC TIẾP TỪ DATABASE POSTGRESQL ĐỂ KIỂM CHỨNG A2
            using (var verifyDb = CreateRealDbContext())
            {
                var dbJob = await verifyDb.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobId == createdJobId);
                dbJob.Should().NotBeNull();
                dbJob!.Status.Should().Be("DRAFT");
                dbJob.SourcingTarget.Should().Be(5);

                // Các cột đề xuất của Client (Proposed*) phải có giá trị trong database
                dbJob.ProposedPricePerCv.Should().Be(450_000m);
                dbJob.ProposedPaymentDueDays.Should().Be(15);
                dbJob.ProposedFeeNote.Should().Be("Doanh nghiệp FPT đề xuất 450.000 VNĐ/CV theo thỏa thuận khung.");

                // Các cột chốt của HR phải hoàn toàn là NULL trong database
                dbJob.SourcingPricePerCv.Should().BeNull();
                dbJob.DepositPercent.Should().BeNull();
                dbJob.ReviewDays.Should().BeNull();
                dbJob.PaymentDueDays.Should().BeNull();
                dbJob.AgreementReference.Should().BeNull();
                dbJob.AgreementNote.Should().BeNull();
                dbJob.AgreedAt.Should().BeNull();
                dbJob.AgreedBy.Should().BeNull();
            }

            // =========================================================================
            // GIAI ĐOẠN A3: SUBMIT JOB VÀO DATABASE (KHÔNG ĐƯỢC TỰ ĐIỀN GIÁ CHỐT)
            // =========================================================================
            using (var dbForSubmit = CreateRealDbContext())
            {
                var jobRepo = new JobRepository(dbForSubmit);
                var memberRepo = new CompanyUserRepository(dbForSubmit);
                var settingRepo = new SystemSettingRepository(dbForSubmit);
                var adminSettings = new BusinessSettingsService(settingRepo);
                var uow = new UnitOfWork(dbForSubmit);

                var targetJob = await dbForSubmit.Jobs.FirstAsync(j => j.JobId == createdJobId);

                var submitHandler = new SubmitJobCommandHandler(jobRepo, memberRepo, adminSettings, uow);
                await submitHandler.Handle(new SubmitJobCommand
                {
                    JobId = createdJobId,
                    UserId = clientUser.UserId,
                    ConcurrencyToken = targetJob.ConcurrencyToken
                }, CancellationToken.None);
            }

            // TRUY VẤN TRỰC TIẾP TỪ DATABASE ĐỂ KIỂM CHỨNG A3
            using (var verifyDb = CreateRealDbContext())
            {
                var dbJob = await verifyDb.Jobs.AsNoTracking().FirstAsync(j => j.JobId == createdJobId);
                dbJob.Status.Should().Be("PENDING_REVIEW");

                // Đảm bảo tuyệt đối A3: Không tự động gán giá mặc định vào các cột chốt
                dbJob.SourcingPricePerCv.Should().BeNull("SubmitJob không được tự ý điền giá chốt");
                dbJob.DepositPercent.Should().BeNull("SubmitJob không được tự ý điền tỷ lệ cọc chốt");
                dbJob.ReviewDays.Should().BeNull("SubmitJob không được tự ý điền hạn xem xét chốt");
            }

            // =========================================================================
            // GIAI ĐOẠN A4.1: QUERY DEFAULTS & PROPOSED TERMS CHO MÀN HÌNH DUYỆT CỦA HR
            // =========================================================================
            using (var dbForDefaults = CreateRealDbContext())
            {
                var jobRepo = new JobRepository(dbForDefaults);
                var settingRepo = new SystemSettingRepository(dbForDefaults);
                var adminSettings = new BusinessSettingsService(settingRepo);

                var defaultsHandler = new GetJobCommercialTermsDefaultsQueryHandler(jobRepo, adminSettings);
                var defaultsResponse = await defaultsHandler.Handle(new GetJobCommercialTermsDefaultsQuery(createdJobId), CancellationToken.None);

                defaultsResponse.Success.Should().BeTrue();
                var json = JsonSerializer.Serialize(defaultsResponse.Data, new JsonSerializerOptions
                {
                    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                });

                // Prefill phải ưu tiên đề xuất của khách (450k) thay vì 600k mặc định
                json.Should().Contain("\"serviceTypeCode\":\"CV_SOURCING\"");
                json.Should().Contain("450000");
                json.Should().Contain("Doanh nghiệp FPT đề xuất 450.000 VNĐ/CV");
            }

            // =========================================================================
            // GIAI ĐOẠN A4.2: INTERNAL HR DUYỆT VÀ CHỐT ĐIỀU KHOẢN VÀO DATABASE POSTGRES
            // =========================================================================
            using (var dbForApprove = CreateRealDbContext())
            {
                var jobRepo = new JobRepository(dbForApprove);
                var settingRepo = new SystemSettingRepository(dbForApprove);
                var adminSettings = new BusinessSettingsService(settingRepo);
                var notifRepo = new NotificationRepository(dbForApprove);
                var reqContext = new Mock<IRequestContext>();
                reqContext.Setup(rc => rc.IpAddress).Returns(System.Net.IPAddress.Loopback);
                reqContext.Setup(rc => rc.UserAgent).Returns("PostgreSQL-Integration-Test");
                var auditLogService = new AuditLogService(dbForApprove, reqContext.Object);
                var uow = new UnitOfWork(dbForApprove);

                var currentJob = await dbForApprove.Jobs.FirstAsync(j => j.JobId == createdJobId);

                var approveHandler = new ApproveJobCommandHandler(jobRepo, adminSettings, notifRepo, auditLogService, uow);

                var approveCommand = new ApproveJobCommand
                {
                    JobId = createdJobId,
                    UserId = hrAdminUser.UserId,
                    ConcurrencyToken = currentJob.ConcurrencyToken,
                    AgreementReference = "HD-2026-FPT-001",
                    Note = "Đã thống nhất đơn giá 450k và tỷ lệ cọc 35% theo phụ lục hợp đồng số 01.",
                    CommercialTerms = new CommercialTermsApprovalRequest(
                        PricePerCv: 450_000m,
                        SourcingTarget: 5,
                        DepositPercent: 35m,
                        ReviewDays: 5,
                        PaymentDueDays: 15)
                };

                var approveResult = await approveHandler.Handle(approveCommand, CancellationToken.None);
                approveResult.Should().NotBeNull();
                approveResult.Data.Status.Should().Be("ACTIVE");
            }

            // TRUY VẤN DATABASE XÁC MINH CÁC CỘT CHỐT THƯƠNG MẠI ĐÃ ĐƯỢC PERSIST
            using (var verifyDb = CreateRealDbContext())
            {
                var dbJob = await verifyDb.Jobs.Include(j => j.AgreedByNavigation)
                    .AsNoTracking().FirstAsync(j => j.JobId == createdJobId);

                dbJob.Status.Should().Be("ACTIVE");
                dbJob.SourcingPricePerCv.Should().Be(450_000m);
                dbJob.DepositPercent.Should().Be(35m);
                dbJob.ReviewDays.Should().Be(5);
                dbJob.PaymentDueDays.Should().Be(15);
                dbJob.AgreementReference.Should().Be("HD-2026-FPT-001");
                dbJob.AgreementNote.Should().Be("Đã thống nhất đơn giá 450k và tỷ lệ cọc 35% theo phụ lục hợp đồng số 01.");
                dbJob.AgreedBy.Should().Be(hrAdminUser.UserId);
                dbJob.AgreedAt.Should().NotBeNull();
                dbJob.AgreedAt!.Value.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(2));

                // Kiểm tra Audit Log thực tế được lưu vào PostgreSQL
                var auditLog = await verifyDb.AuditLogs
                    .FirstOrDefaultAsync(a => a.EntityId == createdJobId && a.Action == AuditActions.JobApproved);
                auditLog.Should().NotBeNull("Audit Log JOB_APPROVED phải được ghi vào PostgreSQL database");
                auditLog!.ActorUserId.Should().Be(hrAdminUser.UserId);
            }

            // =========================================================================
            // GIAI ĐOẠN A5: KIỂM CHỨNG DTO VÀ MASKING BẢO MẬT TỪ DATABASE ENTITY
            // =========================================================================
            using (var verifyDb = CreateRealDbContext())
            {
                var dbJob = await verifyDb.Jobs
                    .Include(j => j.ServiceType)
                    .Include(j => j.AgreedByNavigation)
                    .AsNoTracking()
                    .FirstAsync(j => j.JobId == createdJobId);

                // Phía Client xem (isReviewer = false)
                var clientDto = JobDto.From(dbJob, isReviewer: false);
                clientDto.CommercialTerms.Should().NotBeNull();
                clientDto.CommercialTerms!.PricePerCv.Should().Be(450_000m);
                clientDto.CommercialTerms.DepositPercent.Should().Be(35m);
                clientDto.CommercialTerms.AgreementReference.Should().BeNull("Client tuyệt đối không được thấy AgreementReference nội bộ");
                clientDto.CommercialTerms.AgreementNote.Should().BeNull("Client tuyệt đối không được thấy AgreementNote nội bộ");

                // Phía Internal HR xem (isReviewer = true)
                var hrDto = JobDto.From(dbJob, isReviewer: true);
                hrDto.CommercialTerms.Should().NotBeNull();
                hrDto.CommercialTerms!.AgreementReference.Should().Be("HD-2026-FPT-001");
                hrDto.CommercialTerms.AgreementNote.Should().Be("Đã thống nhất đơn giá 450k và tỷ lệ cọc 35% theo phụ lục hợp đồng số 01.");
                hrDto.CommercialTerms.AgreedBy.Should().NotBeNullOrWhiteSpace();
            }
        }
        finally
        {
            // GIỮ NGUYÊN DỮ LIỆU ĐỂ BẠN XEM TRỰC TIẾP TRÊN PGADMIN
            // Không xóa createdJobId khỏi database
        }
    }
}
