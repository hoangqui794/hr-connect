using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationTimeline;

public class GetRecruitmentApplicationTimelineQueryHandler : IRequestHandler<GetRecruitmentApplicationTimelineQuery, RecruitmentApplicationTimelineResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetRecruitmentApplicationTimelineQueryHandler> _logger;

    public GetRecruitmentApplicationTimelineQueryHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetRecruitmentApplicationTimelineQueryHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<RecruitmentApplicationTimelineResponse> Handle(GetRecruitmentApplicationTimelineQuery request, CancellationToken cancellationToken)
    {
        var app = await _applicationRepository.GetApplicationTimelineDataAsync(request.ApplicationId, cancellationToken);
        if (app == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển với ApplicationId: {ApplicationId}", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");
        }

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (!CompanyMembershipPolicy.IsActive(member) || member.CompanyId != app.Job?.CompanyId)
            {
                _logger.LogWarning("Tài khoản {UserId} không có quyền xem timeline hồ sơ thuộc công ty {CompanyId}", request.UserId, app.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền truy cập hồ sơ ứng tuyển của công ty khác.");
            }

            if (!ClientVisibilityPolicy.IsVisibleToClient(
                    app.Job?.ServiceType?.Code,
                    app.Status,
                    (app.ApplicationStatusHistories ?? []).Select(h => h.NewStatus),
                    app.SourcingDeliveries?.Any() ?? false))
            {
                throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");
            }
        }
        else if (request.IsCandidate)
        {
            if (app.Candidate?.UserId != request.UserId)
            {
                _logger.LogWarning("Ứng viên {UserId} không có quyền xem timeline hồ sơ của ứng viên khác.", request.UserId);
                throw new ForbiddenException("Bạn không có quyền xem dòng thời gian hồ sơ tuyển dụng này.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem dòng thời gian hồ sơ tuyển dụng.", request.UserId);
            throw new ForbiddenException("Bạn không có quyền xem dòng thời gian hồ sơ tuyển dụng.");
        }

        var candidateName = app.Candidate?.FullName ?? "Ứng viên";
        var jobTitle = app.Job?.Title ?? "Vị trí tuyển dụng";
        var events = new List<ApplicationTimelineEventDto>();

        // 1. Hồ sơ được nộp
        events.Add(new ApplicationTimelineEventDto
        {
            EventType = "APPLICATION_APPLIED",
            Title = request.IsCandidate ? "Hồ sơ đã được gửi" : "Nộp hồ sơ ứng tuyển",
            Description = request.IsCandidate
                ? $"Hồ sơ của bạn đã được gửi đến nhà tuyển dụng cho vị trí {jobTitle}."
                : $"Ứng viên {candidateName} đã nộp hồ sơ ứng tuyển vào vị trí {jobTitle}.",
            Timestamp = app.AppliedAt,
            ActorUserId = app.Candidate?.UserId,
            ActorName = candidateName,
            Status = ApplicationStates.Submitted
        });

        // 2. Lịch sử thay đổi trạng thái hồ sơ
        if (app.ApplicationStatusHistories != null)
        {
            foreach (var h in app.ApplicationStatusHistories)
            {
                var candidateCopy = GetCandidateApplicationStatusCopy(h.NewStatus);
                var candidateDisplayStatus = CandidateApplicationDisplayStatusMapper.Map(h.NewStatus);
                events.Add(new ApplicationTimelineEventDto
                {
                    EventType = "APPLICATION_STATUS_CHANGED",
                    Title = request.IsCandidate ? candidateCopy.Title : $"Chuyển trạng thái: {h.NewStatus}",
                    Description = request.IsCandidate
                        ? candidateCopy.Description
                        : !string.IsNullOrWhiteSpace(h.Reason)
                            ? h.Reason
                            : $"Trạng thái chuyển từ {h.OldStatus ?? "Mới"} sang {h.NewStatus}.",
                    Timestamp = h.ChangedAt,
                    ActorUserId = request.IsCandidate ? null : h.ChangedBy,
                    ActorName = request.IsCandidate ? null : (h.ChangedByNavigation?.DisplayName ?? h.ChangedByNavigation?.Email),
                    Status = request.IsCandidate ? candidateDisplayStatus.Group : h.NewStatus,
                    ReasonCode = request.IsCandidate ? null : h.ReasonCode
                });
            }
        }

        // 3. Phỏng vấn
        if (app.Interviews != null)
        {
            foreach (var i in app.Interviews)
            {
                events.Add(new ApplicationTimelineEventDto
                {
                    EventType = "INTERVIEW_SCHEDULED",
                    Title = request.IsCandidate ? $"Lịch phỏng vấn vòng {i.InterviewRound}" : $"Lên lịch phỏng vấn Vòng {i.InterviewRound}",
                    Description = request.IsCandidate
                        ? $"Thời gian: {i.ScheduledAt:dd/MM/yyyy HH:mm}. Hình thức: {ToCandidateInterviewType(i.InterviewType)}."
                        : $"Thời gian: {i.ScheduledAt:yyyy-MM-dd HH:mm} - Hình thức: {i.InterviewType ?? "Trực tiếp"}.",
                    Timestamp = i.CreatedAt,
                    ActorUserId = request.IsCandidate ? null : i.CreatedBy,
                    ActorName = request.IsCandidate ? null : (i.CreatedByNavigation?.DisplayName ?? i.CreatedByNavigation?.Email),
                    Status = request.IsCandidate ? "INTERVIEW" : i.Status
                });

                if (i.InterviewStatusHistories != null)
                {
                    foreach (var sh in i.InterviewStatusHistories)
                    {
                        var candidateHistoryCopy = GetCandidateInterviewStatusCopy(sh.NewStatus, i.InterviewRound);
                        events.Add(new ApplicationTimelineEventDto
                        {
                            EventType = "INTERVIEW_STATUS_CHANGED",
                            Title = request.IsCandidate ? candidateHistoryCopy.Title : $"Cập nhật phỏng vấn Vòng {i.InterviewRound}: {sh.NewStatus}",
                            Description = request.IsCandidate ? candidateHistoryCopy.Description : sh.Reason,
                            Timestamp = sh.ChangedAt,
                            ActorUserId = request.IsCandidate ? null : sh.ChangedBy,
                            ActorName = request.IsCandidate ? null : (sh.ChangedByNavigation?.DisplayName ?? sh.ChangedByNavigation?.Email),
                            Status = request.IsCandidate ? "INTERVIEW" : sh.NewStatus
                        });
                    }
                }

                if (i.RecordedAt.HasValue && !request.IsCandidate)
                {
                    events.Add(new ApplicationTimelineEventDto
                    {
                        EventType = "INTERVIEW_RESULT_RECORDED",
                        Title = $"Kết quả phỏng vấn Vòng {i.InterviewRound}: {i.Result}",
                        Description = !string.IsNullOrWhiteSpace(i.Feedback) ? $"Đánh giá: {i.Feedback}" : $"Kết quả: {i.Result}",
                        Timestamp = i.RecordedAt.Value,
                        ActorUserId = i.RecordedBy,
                        ActorName = i.RecordedByNavigation?.DisplayName ?? i.RecordedByNavigation?.Email,
                        Status = i.Result
                    });
                }
            }
        }

        // 4. Offer
        if (app.Offers != null)
        {
            foreach (var o in app.Offers)
            {
                if (!request.IsCandidate)
                {
                    events.Add(new ApplicationTimelineEventDto
                    {
                        EventType = "OFFER_CREATED",
                        Title = $"Tạo Offer v{o.OfferVersion}",
                        Description = $"Mức lương: {o.Salary:N0} {o.CurrencyCode} - Dự kiến nhận việc: {o.StartDate:yyyy-MM-dd}.",
                        Timestamp = o.CreatedAt,
                        ActorUserId = o.CreatedBy,
                        ActorName = o.CreatedByNavigation?.DisplayName ?? o.CreatedByNavigation?.Email,
                        Status = o.Status
                    });
                }

                if (o.SentAt.HasValue)
                {
                    events.Add(new ApplicationTimelineEventDto
                    {
                        EventType = "OFFER_SENT",
                        Title = request.IsCandidate ? "Bạn đã nhận được lời mời nhận việc" : $"Gửi Offer v{o.OfferVersion}",
                        Description = request.IsCandidate
                            ? "Nhà tuyển dụng đã gửi lời mời nhận việc. Bạn có thể xem chi tiết và phản hồi ngay trên trang này."
                            : $"Offer đã được gửi đến ứng viên {candidateName}.",
                        Timestamp = o.SentAt.Value,
                        ActorUserId = request.IsCandidate ? null : o.CreatedBy,
                        ActorName = request.IsCandidate ? null : (o.CreatedByNavigation?.DisplayName ?? o.CreatedByNavigation?.Email),
                        Status = request.IsCandidate ? "OFFER" : "SENT"
                    });
                }

                if (o.RespondedAt.HasValue)
                {
                    events.Add(new ApplicationTimelineEventDto
                    {
                        EventType = o.Status == "ACCEPTED" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
                        Title = request.IsCandidate
                            ? (o.Status == "ACCEPTED" ? "Bạn đã chấp nhận lời mời nhận việc" : "Bạn đã từ chối lời mời nhận việc")
                            : (o.Status == "ACCEPTED" ? $"Ứng viên chấp nhận Offer v{o.OfferVersion}" : $"Ứng viên từ chối Offer v{o.OfferVersion}"),
                        Description = !string.IsNullOrWhiteSpace(o.DeclineReason) ? $"Lý do: {o.DeclineReason}" : null,
                        Timestamp = o.RespondedAt.Value,
                        ActorUserId = app.Candidate?.UserId,
                        ActorName = candidateName,
                        Status = request.IsCandidate ? (o.Status == "ACCEPTED" ? "HIRED" : "WITHDRAWN") : o.Status
                    });
                }
            }
        }

        // 5. Tiếp nhận việc (Placement)
        if (app.Placement != null)
        {
            var p = app.Placement;
            var desc = request.IsCandidate
                ? $"Vị trí: {p.Position} - Bộ phận: {p.Department} - Ngày bắt đầu: {p.ActualStartDate:yyyy-MM-dd}."
                : $"Vị trí: {p.Position} - Bộ phận: {p.Department} - Ngày bắt đầu: {p.ActualStartDate:yyyy-MM-dd}. {(string.IsNullOrWhiteSpace(p.ConfirmationNote) ? "" : $"Ghi chú: {p.ConfirmationNote}")}".Trim();

            events.Add(new ApplicationTimelineEventDto
            {
                EventType = "PLACEMENT_CONFIRMED",
                Title = "Xác nhận nhận việc thành công",
                Description = desc,
                Timestamp = p.ConfirmedAt != default ? p.ConfirmedAt : p.CreatedAt,
                ActorUserId = request.IsCandidate ? null : p.ConfirmedBy,
                ActorName = request.IsCandidate ? null : (p.ConfirmedByNavigation?.DisplayName ?? p.ConfirmedByNavigation?.Email),
                Status = p.Status
            });
        }

        // Sắp xếp theo dòng thời gian
        var sortedEvents = request.Ascending
            ? events.OrderBy(e => e.Timestamp).ToList()
            : events.OrderByDescending(e => e.Timestamp).ToList();

        return new RecruitmentApplicationTimelineResponse
        {
            Success = true,
            Message = "Lấy dòng thời gian ứng tuyển thành công.",
            Data = new RecruitmentApplicationTimelineData
            {
                ApplicationId = app.ApplicationId,
                CandidateName = candidateName,
                JobTitle = jobTitle,
                CurrentStatus = request.IsCandidate
                    ? CandidateApplicationDisplayStatusMapper.Map(app.Status, app.Offers?.Select(o => o.Status)).Group
                    : app.Status,
                Events = sortedEvents
            }
        };
    }

    private static (string Title, string Description) GetCandidateApplicationStatusCopy(string? status)
    {
        return status?.Trim().ToUpperInvariant() switch
        {
            ApplicationStates.Submitted => ("Hồ sơ đã được gửi", "Nhà tuyển dụng đã nhận được hồ sơ của bạn."),
            ApplicationStates.Screening => ("Nhà tuyển dụng đang xem hồ sơ", "Hồ sơ của bạn đang được nhà tuyển dụng xem xét."),
            ApplicationStates.Shortlisted => ("Bạn đã được chọn vào vòng phỏng vấn", "Nhà tuyển dụng đã chọn hồ sơ của bạn để tiếp tục quy trình."),
            ApplicationStates.Backup => ("Hồ sơ đang được cân nhắc", "Nhà tuyển dụng vẫn đang cân nhắc hồ sơ của bạn."),
            ApplicationStates.Interview => ("Hồ sơ đã chuyển sang bước phỏng vấn", "Nhà tuyển dụng sẽ cập nhật lịch phỏng vấn khi sẵn sàng."),
            ApplicationStates.OfferPending => ("Nhà tuyển dụng đang chuẩn bị lời mời", "Quy trình của bạn đang ở bước chuẩn bị lời mời nhận việc."),
            ApplicationStates.OfferAccepted => ("Bạn đã chấp nhận lời mời nhận việc", "Nhà tuyển dụng sẽ tiếp tục hướng dẫn thủ tục nhận việc."),
            ApplicationStates.Placed => ("Bạn đã hoàn tất quy trình tuyển dụng", "Thông tin nhận việc của bạn đã được xác nhận."),
            ApplicationStates.Rejected or ApplicationStates.InterviewFailed or ApplicationStates.BackupNotSelected or ApplicationStates.Closed
                => ("Chưa phù hợp lần này", "Quy trình tuyển dụng cho đơn này đã kết thúc."),
            ApplicationStates.Withdrawn => ("Bạn đã rút đơn ứng tuyển", "Đơn này không còn trong quy trình tuyển dụng."),
            ApplicationStates.OfferDeclined => ("Bạn đã từ chối lời mời nhận việc", "Quy trình tuyển dụng cho đơn này đã kết thúc."),
            ApplicationStates.NotStarted => ("Không tiếp tục nhận việc", "Quy trình tuyển dụng cho đơn này đã kết thúc."),
            _ => ("Hồ sơ đã được cập nhật", "Nhà tuyển dụng vừa cập nhật tiến trình hồ sơ của bạn.")
        };
    }

    private static (string Title, string Description) GetCandidateInterviewStatusCopy(string? status, int round)
    {
        return status?.Trim().ToUpperInvariant() switch
        {
            "SCHEDULED" => ($"Đã lên lịch phỏng vấn vòng {round}", "Vui lòng kiểm tra thời gian và thông tin tham gia phỏng vấn."),
            "RESCHEDULED" => ($"Lịch phỏng vấn vòng {round} đã thay đổi", "Vui lòng kiểm tra lại thời gian phỏng vấn mới."),
            "COMPLETED" => ($"Đã hoàn thành phỏng vấn vòng {round}", "Nhà tuyển dụng đang xem xét kết quả phỏng vấn."),
            "CANCELLED" => ($"Lịch phỏng vấn vòng {round} đã được hủy", "Nhà tuyển dụng sẽ liên hệ nếu có cập nhật tiếp theo."),
            "NO_SHOW" => ($"Không thể hoàn thành phỏng vấn vòng {round}", "Vui lòng liên hệ nhà tuyển dụng nếu bạn cần hỗ trợ."),
            _ => ($"Lịch phỏng vấn vòng {round} đã được cập nhật", "Vui lòng kiểm tra thông tin phỏng vấn mới nhất.")
        };
    }

    private static string ToCandidateInterviewType(string? interviewType)
    {
        return interviewType?.Trim().ToUpperInvariant() switch
        {
            "ONLINE" or "REMOTE" => "Trực tuyến",
            "PHONE" => "Qua điện thoại",
            "ONSITE" or "OFFLINE" or "IN_PERSON" => "Trực tiếp",
            _ => string.IsNullOrWhiteSpace(interviewType) ? "Trực tiếp" : interviewType
        };
    }
}
