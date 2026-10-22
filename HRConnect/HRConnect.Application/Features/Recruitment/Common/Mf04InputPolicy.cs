using HRConnect.Application.Common.Exceptions;

namespace HRConnect.Application.Features.Recruitment.Common;

public static class Mf04InputPolicy
{
    public const int InterviewTypeMaxLength = 50;
    public const int InterviewLocationMaxLength = 255;
    public const int InterviewMeetingLinkMaxLength = 2048;
    public const int PlacementPositionMaxLength = 180;
    public const int PlacementDepartmentMaxLength = 180;

    public const string OnlineInterviewType = "ONLINE";
    public const string OfflineInterviewType = "OFFLINE";
    public const string PhoneInterviewType = "PHONE";

    public static string? NormalizeOptionalText(string? value, int maxLength, string fieldName)
    {
        if (value == null)
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
        {
            throw new BadRequestException($"{fieldName} không được vượt quá {maxLength} ký tự.");
        }

        return normalized.Length == 0 ? null : normalized;
    }

    public static string NormalizeInterviewType(string? value, string defaultValue = OnlineInterviewType)
    {
        var normalized = NormalizeOptionalText(value, InterviewTypeMaxLength, "Hình thức phỏng vấn")
            ?.ToUpperInvariant();

        if (normalized == null)
        {
            return defaultValue;
        }

        return normalized switch
        {
            OnlineInterviewType or "TRỰC TUYẾN" or "TRUC TUYEN" => OnlineInterviewType,
            OfflineInterviewType or "ONSITE" or "TRỰC TIẾP" or "TRUC TIEP" => OfflineInterviewType,
            PhoneInterviewType or "PHONE_SCREEN" or "ĐIỆN THOẠI" or "DIEN THOAI" => PhoneInterviewType,
            _ => throw new BadRequestException(
                "Hình thức phỏng vấn không hợp lệ. Chỉ chấp nhận ONLINE, OFFLINE hoặc PHONE.")
        };
    }

    public static string? NormalizeMeetingLink(string? value)
    {
        var normalized = NormalizeOptionalText(
            value,
            InterviewMeetingLinkMaxLength,
            "Link phỏng vấn");

        if (normalized == null)
        {
            return null;
        }

        if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new BadRequestException("Link phỏng vấn phải là URL HTTP hoặc HTTPS hợp lệ.");
        }

        return normalized;
    }

    public static void EnsureInterviewVenue(string interviewType, string? location, string? meetingLink)
    {
        if (interviewType == OnlineInterviewType && meetingLink == null)
        {
            throw new BadRequestException("Phỏng vấn ONLINE bắt buộc phải có link phòng họp.");
        }

        if (interviewType == OfflineInterviewType && location == null)
        {
            throw new BadRequestException("Phỏng vấn OFFLINE bắt buộc phải có địa điểm.");
        }
    }

    public static string? NormalizeInterviewNextAction(string result, string? nextAction)
    {
        var normalized = NormalizeOptionalText(nextAction, 30, "Hành động tiếp theo")?.ToUpperInvariant();
        if (normalized == null)
        {
            return null;
        }

        var isValid = result switch
        {
            "PASS" => normalized == "MAKE_OFFER",
            "FAIL" => normalized == "REJECT",
            _ => false
        };

        if (!isValid)
        {
            throw new BadRequestException(
                "Hành động tiếp theo không phù hợp với kết quả phỏng vấn. PASS chỉ nhận MAKE_OFFER; FAIL chỉ nhận REJECT; BACKUP không nhận nextAction.");
        }

        return normalized;
    }
}
