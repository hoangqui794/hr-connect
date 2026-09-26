using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
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
            if (member == null || member.CompanyId != app.Job?.CompanyId)
            {
                _logger.LogWarning("Tài khoản {UserId} không có quyền xem timeline hồ sơ thuộc công ty {CompanyId}", request.UserId, app.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền truy cập hồ sơ ứng tuyển của công ty khác.");
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
            Title = "Nộp hồ sơ ứng tuyển",
            Description = $"Ứng viên {candidateName} đã nộp hồ sơ ứng tuyển vào vị trí {jobTitle}.",
            Timestamp = app.AppliedAt,
            ActorUserId = app.Candidate?.UserId,
            ActorName = candidateName,
            Status = "APPLIED"
        });

        // 2. Lịch sử thay đổi trạng thái hồ sơ
        if (app.ApplicationStatusHistories != null)
        {
            foreach (var h in app.ApplicationStatusHistories)
            {
                events.Add(new ApplicationTimelineEventDto
                {
                    EventType = "APPLICATION_STATUS_CHANGED",
                    Title = $"Chuyển trạng thái: {h.NewStatus}",
                    Description = !string.IsNullOrWhiteSpace(h.Reason)
                        ? h.Reason
                        : $"Trạng thái chuyển từ {h.OldStatus ?? "Mới"} sang {h.NewStatus}.",
                    Timestamp = h.ChangedAt,
                    ActorUserId = h.ChangedBy,
                    ActorName = h.ChangedByNavigation?.DisplayName ?? h.ChangedByNavigation?.Email,
                    Status = h.NewStatus
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
                    Title = $"Lên lịch phỏng vấn Vòng {i.InterviewRound}",
                    Description = $"Thời gian: {i.ScheduledAt:yyyy-MM-dd HH:mm} - Hình thức: {i.InterviewType ?? "Trực tiếp"}.",
                    Timestamp = i.CreatedAt,
                    ActorUserId = i.CreatedBy,
                    ActorName = i.CreatedByNavigation?.DisplayName ?? i.CreatedByNavigation?.Email,
                    Status = i.Status
                });

                if (i.InterviewStatusHistories != null)
                {
                    foreach (var sh in i.InterviewStatusHistories)
                    {
                        events.Add(new ApplicationTimelineEventDto
                        {
                            EventType = "INTERVIEW_STATUS_CHANGED",
                            Title = $"Cập nhật phỏng vấn Vòng {i.InterviewRound}: {sh.NewStatus}",
                            Description = sh.Reason,
                            Timestamp = sh.ChangedAt,
                            ActorUserId = sh.ChangedBy,
                            ActorName = sh.ChangedByNavigation?.DisplayName ?? sh.ChangedByNavigation?.Email,
                            Status = sh.NewStatus
                        });
                    }
                }

                if (i.RecordedAt.HasValue)
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

                if (o.SentAt.HasValue)
                {
                    events.Add(new ApplicationTimelineEventDto
                    {
                        EventType = "OFFER_SENT",
                        Title = $"Gửi Offer v{o.OfferVersion}",
                        Description = $"Offer đã được gửi đến ứng viên {candidateName}.",
                        Timestamp = o.SentAt.Value,
                        Status = "SENT"
                    });
                }

                if (o.RespondedAt.HasValue)
                {
                    events.Add(new ApplicationTimelineEventDto
                    {
                        EventType = o.Status == "ACCEPTED" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
                        Title = o.Status == "ACCEPTED" ? $"Ứng viên chấp nhận Offer v{o.OfferVersion}" : $"Ứng viên từ chối Offer v{o.OfferVersion}",
                        Description = !string.IsNullOrWhiteSpace(o.DeclineReason) ? $"Lý do: {o.DeclineReason}" : null,
                        Timestamp = o.RespondedAt.Value,
                        ActorUserId = app.Candidate?.UserId,
                        ActorName = candidateName,
                        Status = o.Status
                    });
                }
            }
        }

        // 5. Tiếp nhận việc (Placement)
        if (app.Placement != null)
        {
            var p = app.Placement;
            events.Add(new ApplicationTimelineEventDto
            {
                EventType = "PLACEMENT_CONFIRMED",
                Title = "Xác nhận nhận việc thành công",
                Description = $"Vị trí: {p.Position} - Bộ phận: {p.Department} - Ngày bắt đầu: {p.ActualStartDate:yyyy-MM-dd}. {(string.IsNullOrWhiteSpace(p.ConfirmationNote) ? "" : $"Ghi chú: {p.ConfirmationNote}")}".Trim(),
                Timestamp = p.ConfirmedAt != default ? p.ConfirmedAt : p.CreatedAt,
                ActorUserId = p.ConfirmedBy,
                ActorName = p.ConfirmedByNavigation?.DisplayName ?? p.ConfirmedByNavigation?.Email,
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
                CurrentStatus = app.Status,
                Events = sortedEvents
            }
        };
    }
}
