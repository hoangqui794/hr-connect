using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICandidateRepository
{
    /// <summary>
    /// Tìm kiếm danh tính ứng viên theo normalized_email hoặc normalized_phone.
    /// Ưu tiên tìm theo normalized_email trước, nếu không có thì tìm theo normalized_phone.
    /// </summary>
    Task<Candidate?> FindByIdentityAsync(string? normalizedEmail, string? normalizedPhone, CancellationToken cancellationToken = default);

    Task AddAsync(Candidate candidate, CancellationToken cancellationToken = default);

    void Update(Candidate candidate);

    /// <summary>
    /// Lấy thông tin ứng viên cơ bản theo UserId.
    /// </summary>
    Task<Candidate?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lấy thông tin chi tiết ứng viên theo UserId, kèm Skills và CV.
    /// </summary>
    Task<Candidate?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default);
}
