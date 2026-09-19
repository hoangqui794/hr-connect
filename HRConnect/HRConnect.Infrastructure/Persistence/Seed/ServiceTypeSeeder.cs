using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

public static class ServiceTypeSeeder
{
    public static readonly (string Code, string Name, string Description, bool IsActive)[] ExpectedServiceTypes =
    [
        ("CV_APPLICATION", "CV Application", "Open candidate application service", true),
        ("HEADHUNT_COD", "Headhunt COD", "Commission-based headhunting service", true),
        ("CV_SOURCING", "CV Sourcing", "Candidate CV sourcing service", true)
    ];

    /// <summary>
    /// Nạp dữ liệu danh mục loại dịch vụ (Service Type) một cách an toàn và idempotent.
    /// Sử dụng ServiceType.Code làm khóa nghiệp vụ (business key), không phụ thuộc hay ghi đè UUID sẵn có trong DB.
    /// </summary>
    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var expectedCodes = ExpectedServiceTypes.Select(s => s.Code).ToList();

        // 1. Tải danh sách code đã tồn tại trong DB bằng 1 truy vấn duy nhất (tránh N+1 query)
        var existingCodes = await context.ServiceTypes
            .Where(st => expectedCodes.Contains(st.Code))
            .Select(st => st.Code)
            .ToListAsync(cancellationToken);

        var existingCodeSet = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

        // 2. Lọc danh sách các loại dịch vụ còn thiếu
        var missingServiceTypes = ExpectedServiceTypes
            .Where(s => !existingCodeSet.Contains(s.Code))
            .ToList();

        // Nếu tất cả đã tồn tại: không chèn trùng lặp, không gọi SaveChangesAsync, không spam log
        if (missingServiceTypes.Count == 0)
        {
            return;
        }

        var now = DateTime.UtcNow;

        // 3. Thêm các bản ghi còn thiếu
        foreach (var (code, name, description, isActive) in missingServiceTypes)
        {
            var newServiceType = new ServiceType
            {
                ServiceTypeId = Guid.NewGuid(),
                Code = code,
                Name = name,
                Description = description,
                IsActive = isActive,
                CreatedAt = now,
                UpdatedAt = now
            };

            await context.ServiceTypes.AddAsync(newServiceType, cancellationToken);
            logger?.LogInformation("Added missing service type: {Code}", code);
        }

        // 4. Lưu thay đổi với cơ chế xử lý tương tranh an toàn
        try
        {
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Service type seed completed. Inserted {Count} missing record(s).", missingServiceTypes.Count);
        }
        catch (DbUpdateException ex)
        {
            logger?.LogWarning(ex, "Service type seed encountered a database concurrency conflict. Records may have already been seeded by another instance.");
            foreach (var entry in context.ChangeTracker.Entries<ServiceType>().Where(e => e.State == EntityState.Added))
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
