using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HRConnect.Domain.Entities;

namespace HRConnect.Infrastructure.Services.JobMatching;

public sealed record HybridJobMatchResult(
    decimal Score,
    string? TierCode,
    IReadOnlyList<string> MatchingReasons,
    IReadOnlyList<string> MissingRequirements,
    IReadOnlyDictionary<string, decimal> Components);

/// <summary>
/// Deterministic and auditable business layer placed on top of the existing semantic CV-JD score.
/// It intentionally excludes identity and protected personal attributes.
/// </summary>
public static class HybridJobMatchScorer
{
    public const string Version = "HYBRID_V1";

    private const decimal SemanticWeight = 45m;
    private const decimal SkillsWeight = 25m;
    private const decimal ExperienceWeight = 10m;
    private const decimal TargetRoleWeight = 8m;
    private const decimal LocationWeight = 5m;
    private const decimal SalaryWeight = 5m;
    private const decimal FreshnessWeight = 2m;

    public static HybridJobMatchResult Evaluate(
        Candidate candidate,
        Job job,
        decimal semanticScore,
        IReadOnlyCollection<MatchTierConfig> tiers,
        DateTime now)
    {
        var weighted = new List<(string Key, decimal Weight, decimal Value)>();
        var reasons = new List<string>();
        var gaps = new List<string>();

        Add(weighted, "semantic", SemanticWeight, Clamp01(semanticScore / 100m));

        var jobSkills = job.JobSkills.OrderByDescending(s => s.IsMandatory).ThenBy(s => s.SkillId).ToList();
        if (jobSkills.Count > 0)
        {
            var candidateSkills = candidate.CandidateSkills.Select(s => s.SkillId).ToHashSet();
            var total = jobSkills.Sum(SkillWeight);
            var matched = jobSkills.Where(s => candidateSkills.Contains(s.SkillId)).ToList();
            var skillScore = total <= 0m ? 0m : matched.Sum(SkillWeight) / total;
            Add(weighted, "skills", SkillsWeight, skillScore);

            var names = matched.Select(s => s.Skill?.SkillName).Where(n => !string.IsNullOrWhiteSpace(n)).Take(3).ToList();
            if (names.Count > 0) reasons.Add($"Kỹ năng phù hợp: {string.Join(", ", names)}");

            var missingMandatory = jobSkills
                .Where(s => s.IsMandatory && !candidateSkills.Contains(s.SkillId))
                .Select(s => s.Skill?.SkillName)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Take(3);
            gaps.AddRange(missingMandatory.Select(n => $"Chưa thể hiện kỹ năng bắt buộc: {n}"));
        }

        if (job.MinExperienceYears.HasValue && candidate.YearsOfExperience.HasValue)
        {
            var required = Math.Max(0, job.MinExperienceYears.Value);
            var actual = Math.Max(0m, candidate.YearsOfExperience.Value);
            var experienceScore = required == 0 ? 1m : Clamp01(actual / required);
            Add(weighted, "experience", ExperienceWeight, experienceScore);
            if (experienceScore >= 1m) reasons.Add($"Đáp ứng yêu cầu tối thiểu {required} năm kinh nghiệm");
            else gaps.Add($"Kinh nghiệm hiện tại {actual:0.#} năm, công việc yêu cầu tối thiểu {required} năm");
        }

        if (!string.IsNullOrWhiteSpace(candidate.TargetRole) && !string.IsNullOrWhiteSpace(job.Title))
        {
            var roleScore = TokenOverlap(candidate.TargetRole, job.Title);
            Add(weighted, "targetRole", TargetRoleWeight, roleScore);
            if (roleScore >= 0.5m) reasons.Add("Vị trí gần với định hướng nghề nghiệp của bạn");
        }

        if (!string.IsNullOrWhiteSpace(candidate.PreferredLocations) && !string.IsNullOrWhiteSpace(job.Location))
        {
            var preferred = SplitPreferences(candidate.PreferredLocations);
            var normalizedJobLocation = Normalize(job.Location);
            var locationMatch = preferred.Any(p => normalizedJobLocation.Contains(p, StringComparison.Ordinal) || p.Contains(normalizedJobLocation, StringComparison.Ordinal));
            Add(weighted, "location", LocationWeight, locationMatch ? 1m : 0m);
            if (locationMatch) reasons.Add("Địa điểm phù hợp với khu vực mong muốn");
            else gaps.Add("Địa điểm chưa trùng với khu vực bạn ưu tiên");
        }

        if ((job.SalaryMin.HasValue || job.SalaryMax.HasValue || job.SalaryNegotiable) &&
            (candidate.ExpectedSalaryMin.HasValue || candidate.ExpectedSalaryMax.HasValue) &&
            string.Equals(job.CurrencyCode?.Trim(), candidate.ExpectedSalaryCurrency?.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            var salaryMatch = job.SalaryNegotiable || RangesOverlap(
                job.SalaryMin, job.SalaryMax, candidate.ExpectedSalaryMin, candidate.ExpectedSalaryMax);
            Add(weighted, "salary", SalaryWeight, salaryMatch ? 1m : 0m);
            if (salaryMatch) reasons.Add("Khoảng lương phù hợp với kỳ vọng của bạn");
            else gaps.Add("Khoảng lương công bố chưa giao với mức kỳ vọng");
        }

        var postedAt = job.PostedAt ?? job.CreatedAt;
        var ageDays = Math.Max(0, (now - postedAt).TotalDays);
        var freshness = ageDays <= 7 ? 1m : ageDays <= 30 ? 0.7m : ageDays <= 90 ? 0.4m : 0.2m;
        Add(weighted, "freshness", FreshnessWeight, freshness);
        if (ageDays <= 7) reasons.Add("Tin tuyển dụng mới đăng");

        var activeWeight = weighted.Sum(x => x.Weight);
        var score = activeWeight == 0m ? 0m : Math.Round(weighted.Sum(x => x.Weight * x.Value) / activeWeight * 100m, 2);
        var tier = tiers.Where(t => t.IsActive && score >= t.MinScore && score <= t.MaxScore)
            .OrderBy(t => t.DisplayOrder)
            .Select(t => t.TierCode)
            .FirstOrDefault();

        if (reasons.Count == 0 && semanticScore >= 60m) reasons.Add("Nội dung CV có nhiều điểm tương đồng với mô tả công việc");

        return new HybridJobMatchResult(
            Math.Clamp(score, 0m, 100m),
            tier,
            reasons.Distinct(StringComparer.OrdinalIgnoreCase).Take(5).ToList(),
            gaps.Distinct(StringComparer.OrdinalIgnoreCase).Take(5).ToList(),
            weighted.ToDictionary(x => x.Key, x => Math.Round(x.Value * 100m, 2)));
    }

    public static string BuildFingerprint(Candidate candidate, CandidateCv cv, Job job)
    {
        var payload = new
        {
            version = Version,
            cv = new { cv.CvId, cv.ContentSha256, cv.UpdatedAt },
            candidate = new
            {
                candidate.TargetRole,
                candidate.YearsOfExperience,
                candidate.ExpectedSalaryMin,
                candidate.ExpectedSalaryMax,
                candidate.ExpectedSalaryCurrency,
                candidate.PreferredLocations,
                candidate.PreferredWorkModes,
                skills = candidate.CandidateSkills.OrderBy(s => s.SkillId)
                    .Select(s => new { s.SkillId, s.ProficiencyLevel, s.YearsOfExperience })
            },
            job = new
            {
                job.JobId,
                job.Title,
                job.Description,
                job.Location,
                job.WorkingTime,
                job.EmploymentType,
                job.SalaryMin,
                job.SalaryMax,
                job.SalaryNegotiable,
                job.CurrencyCode,
                job.MinExperienceYears,
                job.MaxExperienceYears,
                job.UpdatedAt,
                skills = job.JobSkills.OrderBy(s => s.SkillId)
                    .Select(s => new { s.SkillId, s.IsMandatory, s.Weight })
            }
        };
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }

    private static decimal SkillWeight(JobSkill skill) =>
        skill.Weight is > 0m ? skill.Weight.Value : skill.IsMandatory ? 2m : 1m;

    private static void Add(ICollection<(string Key, decimal Weight, decimal Value)> scores, string key, decimal weight, decimal value) =>
        scores.Add((key, weight, Clamp01(value)));

    private static decimal Clamp01(decimal value) => Math.Clamp(value, 0m, 1m);

    private static decimal TokenOverlap(string left, string right)
    {
        var a = Tokenize(left);
        var b = Tokenize(right);
        if (a.Count == 0 || b.Count == 0) return 0m;
        return (decimal)a.Intersect(b).Count() / a.Count;
    }

    private static HashSet<string> Tokenize(string value) => Normalize(value)
        .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(token => token.Length > 1)
        .ToHashSet(StringComparer.Ordinal);

    private static List<string> SplitPreferences(string raw)
    {
        try
        {
            if (raw.TrimStart().StartsWith('['))
            {
                return (JsonSerializer.Deserialize<List<string>>(raw) ?? [])
                    .Select(Normalize).Where(x => x.Length > 0).ToList();
            }
        }
        catch (JsonException)
        {
            // Fall back to tolerant delimited parsing for legacy data.
        }

        return raw.Split([',', ';', '|'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(Normalize).Where(x => x.Length > 0).ToList();
    }

    private static string Normalize(string value)
    {
        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var chars = normalized.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Select(c => char.IsLetterOrDigit(c) ? c : ' ')
            .ToArray();
        return string.Join(' ', new string(chars).Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static bool RangesOverlap(decimal? aMin, decimal? aMax, decimal? bMin, decimal? bMax)
    {
        var leftMin = aMin ?? aMax ?? 0m;
        var leftMax = aMax ?? aMin ?? decimal.MaxValue;
        var rightMin = bMin ?? bMax ?? 0m;
        var rightMax = bMax ?? bMin ?? decimal.MaxValue;
        return leftMin <= rightMax && rightMin <= leftMax;
    }
}
