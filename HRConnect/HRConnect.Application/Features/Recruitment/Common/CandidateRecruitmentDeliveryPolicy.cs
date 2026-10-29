using System.Net.Mail;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Recruitment.Common;

/// <summary>
/// Resolves the durable channels available for recruitment events. Most events still use the
/// primary channel in <see cref="CandidateRecruitmentDeliveryDecision.Channel"/>. Interview
/// delivery may additionally use <see cref="CandidateRecruitmentDeliveryDecision.RecipientEmail"/>
/// so a linked account receives both an in-app notice and a critical schedule email.
/// </summary>
public static class CandidateRecruitmentDeliveryPolicy
{
    public const string DeliveryUnavailableErrorCode = "CANDIDATE_DELIVERY_UNAVAILABLE";

    public static CandidateRecruitmentDeliveryDecision Resolve(Candidate? candidate)
    {
        if (candidate?.UserId is { } userId && userId != Guid.Empty)
        {
            return new CandidateRecruitmentDeliveryDecision(
                CandidateRecruitmentDeliveryChannel.InApp,
                userId,
                NormalizeEmail(candidate.Email));
        }

        var email = NormalizeEmail(candidate?.Email);
        return email is null
            ? new CandidateRecruitmentDeliveryDecision(CandidateRecruitmentDeliveryChannel.Unavailable, null, null)
            : new CandidateRecruitmentDeliveryDecision(CandidateRecruitmentDeliveryChannel.Email, null, email);
    }

    /// <summary>
    /// Initial invitations must have a reachable delivery channel. This protects a Client from
    /// moving a candidate into INTERVIEW/OFFER_SENT without the candidate being informed.
    /// </summary>
    public static CandidateRecruitmentDeliveryDecision RequireReachable(Candidate? candidate)
    {
        var delivery = Resolve(candidate);
        if (delivery.Channel == CandidateRecruitmentDeliveryChannel.Unavailable)
        {
            throw new BadRequestException(
                "Ứng viên chưa liên kết tài khoản và chưa có email hợp lệ để nhận thông báo. Vui lòng bổ sung email trước khi tiếp tục.",
                DeliveryUnavailableErrorCode);
        }

        return delivery;
    }

    public static string? NormalizeEmail(string? rawEmail)
    {
        if (string.IsNullOrWhiteSpace(rawEmail))
        {
            return null;
        }

        var email = rawEmail.Trim();
        try
        {
            var parsed = new MailAddress(email);
            return string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase)
                ? parsed.Address
                : null;
        }
        catch (FormatException)
        {
            return null;
        }
    }
}

public enum CandidateRecruitmentDeliveryChannel
{
    InApp,
    Email,
    InAppAndEmail,
    Unavailable
}

public sealed record CandidateRecruitmentDeliveryDecision(
    CandidateRecruitmentDeliveryChannel Channel,
    Guid? UserId,
    string? RecipientEmail);

public static class CandidateRecruitmentDeliveryChannelExtensions
{
    public static string ToApiValue(this CandidateRecruitmentDeliveryChannel channel) => channel switch
    {
        CandidateRecruitmentDeliveryChannel.InApp => "IN_APP",
        CandidateRecruitmentDeliveryChannel.Email => "EMAIL",
        CandidateRecruitmentDeliveryChannel.InAppAndEmail => "IN_APP_AND_EMAIL",
        _ => "UNAVAILABLE"
    };
}
