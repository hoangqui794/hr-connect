using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;

namespace HRConnect.Application.Features.Interviews.Common;

public static class InterviewParticipantPolicy
{
    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "INTERVIEWER",
        "LEAD_INTERVIEWER",
        "TECHNICAL_LEAD",
        "HIRING_MANAGER",
        "OBSERVER"
    };

    public static async Task<IReadOnlyList<ScheduleInterviewParticipantDto>> ValidateAndNormalizeAsync(
        IReadOnlyCollection<ScheduleInterviewParticipantDto> participants,
        Guid companyId,
        ICompanyUserRepository companyUserRepository,
        CancellationToken cancellationToken)
    {
        var duplicateUserId = participants
            .GroupBy(participant => participant.UserId)
            .FirstOrDefault(group => group.Count() > 1)?.Key;
        if (duplicateUserId.HasValue)
        {
            throw new BadRequestException("Danh sách người phỏng vấn không được chứa trùng người dùng.");
        }

        var normalized = participants
            .Select(participant => new ScheduleInterviewParticipantDto(
                participant.UserId,
                string.IsNullOrWhiteSpace(participant.Role)
                    ? "INTERVIEWER"
                    : participant.Role.Trim().ToUpperInvariant()))
            .ToList();

        var invalidRole = normalized.FirstOrDefault(participant => !AllowedRoles.Contains(participant.Role));
        if (invalidRole != null)
        {
            throw new BadRequestException($"Vai trò người phỏng vấn '{invalidRole.Role}' không hợp lệ.");
        }

        var userIds = normalized.Select(participant => participant.UserId).ToArray();
        var activeCompanyUsers = await companyUserRepository.GetActiveByUserIdsAsync(
            companyId,
            userIds,
            cancellationToken);
        var activeUserIds = activeCompanyUsers.Select(companyUser => companyUser.UserId).ToHashSet();
        var invalidUserIds = userIds.Where(userId => !activeUserIds.Contains(userId)).ToArray();
        if (invalidUserIds.Length > 0)
        {
            throw new BadRequestException("Người phỏng vấn phải là thành viên đang hoạt động của doanh nghiệp sở hữu job.");
        }

        return normalized;
    }
}
