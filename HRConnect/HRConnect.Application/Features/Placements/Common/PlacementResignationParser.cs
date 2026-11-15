using System;
using System.Globalization;
using System.Text.RegularExpressions;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Placements.Common;

internal static class PlacementResignationParser
{
    private static readonly Regex ResignationNoteRegex = new(
        @"ngày làm việc cuối\s+(\d{4}-\d{2}-\d{2})(?::\s*(.+))?$",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    public static (DateOnly? EndDate, string? Reason, string? ResignedBy) Extract(Placement? placement, Warranty? warranty = null)
    {
        var effectiveWarranty = warranty ?? placement?.Warranty;
        var isLeft = placement != null && (
            string.Equals(placement.Status, PlacementStates.LeftDuringWarranty, StringComparison.OrdinalIgnoreCase)
            || string.Equals(placement.Status, "RESIGNED", StringComparison.OrdinalIgnoreCase));
        var warrantyStatus = effectiveWarranty?.Status;
        var hasClaimOrVoided = string.Equals(warrantyStatus, WarrantyStates.Claimed, StringComparison.OrdinalIgnoreCase)
                               || string.Equals(warrantyStatus, WarrantyStates.Voided, StringComparison.OrdinalIgnoreCase);

        if (!isLeft && !hasClaimOrVoided)
        {
            return (null, null, null);
        }

        var noteBeforeHr = effectiveWarranty?.ResultNote?.Split(" | Internal HR ", 2, StringSplitOptions.None)[0].Trim();
        DateOnly? endDate = null;
        string? reason = null;

        if (!string.IsNullOrWhiteSpace(noteBeforeHr))
        {
            var match = ResignationNoteRegex.Match(noteBeforeHr);
            if (match.Success)
            {
                if (DateOnly.TryParseExact(
                        match.Groups[1].Value,
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out var parsedDate))
                {
                    endDate = parsedDate;
                }

                var parsedReason = match.Groups[2].Value.Trim();
                reason = string.IsNullOrWhiteSpace(parsedReason) ? null : parsedReason;
            }
            else
            {
                reason = noteBeforeHr;
            }
        }

        if (endDate == null && isLeft && placement != null)
        {
            endDate = DateOnly.FromDateTime(placement.UpdatedAt);
        }

        string? resignedBy = hasClaimOrVoided
                             || (placement != null && string.Equals(placement.Status, PlacementStates.LeftDuringWarranty, StringComparison.OrdinalIgnoreCase))
                             || (noteBeforeHr?.StartsWith("Client báo nghỉ", StringComparison.OrdinalIgnoreCase) ?? false)
            ? "CLIENT"
            : null;

        return (endDate, reason, resignedBy);
    }

    public static string? ExtractResolutionNote(Warranty? warranty)
    {
        if (string.IsNullOrWhiteSpace(warranty?.ResultNote))
        {
            return null;
        }

        var parts = warranty.ResultNote.Split(" | Internal HR ", 2, StringSplitOptions.None);
        if (parts.Length < 2)
        {
            return null;
        }

        var hrPart = parts[1].Trim();
        return string.IsNullOrWhiteSpace(hrPart) ? null : hrPart;
    }
}
