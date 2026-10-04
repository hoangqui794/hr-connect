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
    public const string UserSuspended = "USER_SUSPENDED";
    public const string UserReactivated = "USER_REACTIVATED";
    public const string UserLoginUnlocked = "USER_LOGIN_UNLOCKED";
    public const string AffiliateCvViewed = "AFFILIATE_CV_VIEWED";
    public const string ApplicationStatusChanged = "APPLICATION_STATUS_CHANGED";
    public const string ApplicationBackupDecided = "APPLICATION_BACKUP_DECIDED";
    public const string ApplicationWithdrawn = "APPLICATION_WITHDRAWN";
    public const string ApplicationPlannedStartDateUpdated = "APPLICATION_PLANNED_START_DATE_UPDATED";
    public const string ApplicationNotStarted = "APPLICATION_NOT_STARTED";
    public const string InterviewScheduled = "INTERVIEW_SCHEDULED";
    public const string InterviewUpdated = "INTERVIEW_UPDATED";
    public const string InterviewRescheduled = "INTERVIEW_RESCHEDULED";
    public const string InterviewCancelled = "INTERVIEW_CANCELLED";
    public const string InterviewNoShowRecorded = "INTERVIEW_NO_SHOW_RECORDED";
    public const string InterviewResultRecorded = "INTERVIEW_RESULT_RECORDED";
    public const string OfferDraftCreated = "OFFER_DRAFT_CREATED";
    public const string OfferUpdated = "OFFER_UPDATED";
    public const string OfferSent = "OFFER_SENT";
    public const string OfferAccepted = "OFFER_ACCEPTED";
    public const string OfferDeclined = "OFFER_DECLINED";
    public const string OfferWithdrawn = "OFFER_WITHDRAWN";
    public const string PlacementConfirmed = "PLACEMENT_CONFIRMED";
}
