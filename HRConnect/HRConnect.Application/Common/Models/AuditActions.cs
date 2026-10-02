namespace HRConnect.Application.Common.Models;

public static class AuditActions
{
    public const string CvUploaded = "CV_UPLOADED";
    public const string CvUpdated = "CV_UPDATED";
    public const string CvPrimarySet = "CV_PRIMARY_SET";
    public const string CvDeleted = "CV_DELETED";
    public const string ApplicationSubmitted = "APPLICATION_SUBMITTED";
    public const string AffiliateSubmissionCreated = "AFFILIATE_SUBMISSION_CREATED";
    public const string SubmissionDuplicateBlocked = "SUBMISSION_DUPLICATE_BLOCKED";
    public const string SubmissionConsentConfirmed = "SUBMISSION_CONSENT_CONFIRMED";
    public const string SubmissionConsentDeclined = "SUBMISSION_CONSENT_DECLINED";
    public const string SubmissionConsentClosed = "SUBMISSION_CONSENT_CLOSED";
}
