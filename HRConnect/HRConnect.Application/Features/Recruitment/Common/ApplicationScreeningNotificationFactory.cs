using System.Text.Json;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.Recruitment.Common;

public static class ApplicationScreeningNotificationFactory
{
    public const string NotificationType = "APPLICATION_STATUS";

    public static Notification CreateCandidate(JobApplication application, string status, DateTime createdAt)
    {
        var selected = status == ApplicationStates.Shortlisted;
        return Create(
            application.Candidate.UserId!.Value,
            application,
            status,
            createdAt,
            selected ? "Hồ sơ đã qua vòng sàng lọc" : "Cập nhật hồ sơ ứng tuyển",
            selected
                ? $"Hồ sơ của bạn cho vị trí {application.Job.Title} đã được chọn vào vòng tiếp theo."
                : $"Hồ sơ của bạn cho vị trí {application.Job.Title} hiện chưa phù hợp.");
    }

    public static Notification CreateAffiliate(JobApplication application, string status, DateTime createdAt)
    {
        var selected = status == ApplicationStates.Shortlisted;
        return Create(
            application.Attribution!.Affiliate.UserId,
            application,
            status,
            createdAt,
            selected ? "Ứng viên đã qua sàng lọc" : "Cập nhật hồ sơ ứng viên giới thiệu",
            selected
                ? $"Ứng viên {application.Candidate.FullName} đã qua sàng lọc cho vị trí {application.Job.Title}."
                : $"Hồ sơ của ứng viên {application.Candidate.FullName} hiện chưa được chọn cho vị trí {application.Job.Title}.");
    }

    private static Notification Create(
        Guid userId,
        JobApplication application,
        string status,
        DateTime createdAt,
        string title,
        string message) => new()
    {
        NotificationId = Guid.NewGuid(),
        UserId = userId,
        NotificationType = NotificationType,
        Title = title,
        Message = message,
        RelatedEntityType = "APPLICATION",
        RelatedEntityId = application.ApplicationId,
        Metadata = JsonSerializer.Serialize(new { applicationId = application.ApplicationId, application.JobId, status }),
        IsRead = false,
        CreatedAt = createdAt
    };
}
