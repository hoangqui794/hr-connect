using System.Text.Json;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.SubmissionConsents.Common;

public static class SubmissionConsentNotificationFactory
{
    public const string NotificationType = "SUBMISSION_CONSENT_RESULT";

    public static Notification CreateAffiliateResult(Submission submission, string status, DateTime createdAt)
    {
        var normalizedStatus = status.ToUpperInvariant();
        var (title, message) = normalizedStatus switch
        {
            "CONFIRMED" => (
                "Candidate đã đồng ý nộp hồ sơ",
                $"Candidate {submission.Candidate.FullName} đã đồng ý nộp hồ sơ vào vị trí {submission.Job.Title}."),
            "DECLINED" => (
                "Candidate đã từ chối nộp hồ sơ",
                $"Candidate {submission.Candidate.FullName} đã từ chối cho phép nộp hồ sơ vào vị trí {submission.Job.Title}."),
            "EXPIRED" => (
                "Yêu cầu xác nhận đã hết hạn",
                $"Candidate {submission.Candidate.FullName} chưa phản hồi yêu cầu nộp hồ sơ vào vị trí {submission.Job.Title} trước thời hạn."),
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported consent result.")
        };

        return new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = submission.SubmittedBy,
            NotificationType = NotificationType,
            Title = title,
            Message = message,
            RelatedEntityType = "SUBMISSION",
            RelatedEntityId = submission.SubmissionId,
            Metadata = JsonSerializer.Serialize(new
            {
                status = normalizedStatus,
                submission.CandidateId,
                submission.JobId
            }),
            IsRead = false,
            CreatedAt = createdAt
        };
    }
}
