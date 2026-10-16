using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Settings;

namespace HRConnect.Application.Features.Reports.Common;

public sealed record AffiliateRatingConfig(
    decimal WeightHire,
    decimal WeightShortlist,
    decimal HireRateTarget,
    int MinSubmissions,
    decimal ExcellentMin,
    decimal GoodMin,
    decimal AverageMin)
{
    public static async Task<AffiliateRatingConfig> LoadAsync(IAdminBusinessSettings settings, CancellationToken cancellationToken = default)
    {
        return new AffiliateRatingConfig(
            await settings.GetDecimalAsync(BusinessSettingKeys.AffiliateRatingWeightHire, cancellationToken),
            await settings.GetDecimalAsync(BusinessSettingKeys.AffiliateRatingWeightShortlist, cancellationToken),
            await settings.GetDecimalAsync(BusinessSettingKeys.AffiliateRatingHireRateTarget, cancellationToken),
            await settings.GetIntAsync(BusinessSettingKeys.AffiliateRatingMinSubmissions, cancellationToken),
            await settings.GetDecimalAsync(BusinessSettingKeys.AffiliateRatingExcellentMin, cancellationToken),
            await settings.GetDecimalAsync(BusinessSettingKeys.AffiliateRatingGoodMin, cancellationToken),
            await settings.GetDecimalAsync(BusinessSettingKeys.AffiliateRatingAverageMin, cancellationToken));
    }
}

public sealed record AffiliateRatingResult(
    decimal? SubmissionToHireRate,
    decimal? QualityRating,
    string RatingLabel);

public static class AffiliateRatingCalculator
{
    public const string LabelExcellent = "EXCELLENT";
    public const string LabelGood = "GOOD";
    public const string LabelAverage = "AVERAGE";
    public const string LabelLow = "LOW";
    public const string LabelNew = "NEW";

    public static AffiliateRatingResult Calculate(
        int totalSubmissions,
        int totalShortlisted,
        int totalPlacements,
        AffiliateRatingConfig config)
    {
        if (totalSubmissions <= 0)
        {
            return new AffiliateRatingResult(null, null, LabelNew);
        }

        var submissionToHireRate = Math.Round((decimal)totalPlacements / totalSubmissions, 4);

        if (totalSubmissions < config.MinSubmissions)
        {
            return new AffiliateRatingResult(submissionToHireRate, null, LabelNew);
        }

        var shortlistRate = (decimal)totalShortlisted / totalSubmissions;
        var hireRateTarget = config.HireRateTarget <= 0 ? 0.20m : config.HireRateTarget;
        var hireRateNormalized = Math.Min(submissionToHireRate / hireRateTarget, 1.0m);

        var score = 5.0m * (config.WeightHire * hireRateNormalized + config.WeightShortlist * shortlistRate);
        var qualityRating = Math.Round(Math.Clamp(score, 0m, 5.0m), 1, MidpointRounding.AwayFromZero);

        string label;
        if (qualityRating >= config.ExcellentMin)
        {
            label = LabelExcellent;
        }
        else if (qualityRating >= config.GoodMin)
        {
            label = LabelGood;
        }
        else if (qualityRating >= config.AverageMin)
        {
            label = LabelAverage;
        }
        else
        {
            label = LabelLow;
        }

        return new AffiliateRatingResult(submissionToHireRate, qualityRating, label);
    }
}
