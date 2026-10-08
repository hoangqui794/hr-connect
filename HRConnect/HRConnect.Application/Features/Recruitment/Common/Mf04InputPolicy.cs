using HRConnect.Application.Common.Exceptions;

namespace HRConnect.Application.Features.Recruitment.Common;

public static class Mf04InputPolicy
{
    public const int InterviewTypeMaxLength = 50;
    public const int InterviewLocationMaxLength = 255;
    public const int PlacementPositionMaxLength = 180;
    public const int PlacementDepartmentMaxLength = 180;

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
