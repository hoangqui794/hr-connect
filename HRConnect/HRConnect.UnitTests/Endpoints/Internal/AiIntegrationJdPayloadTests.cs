using System.Text.Json;
using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Presentation.Endpoints.Internal;

namespace HRConnect.UnitTests.Endpoints.Internal;

public class AiIntegrationJdPayloadTests
{
    [Fact]
    public void BuildJobJdPayload_AttachesMinYearsOnlyToExperienceRequirementsAndPreservesSkills()
    {
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Senior Backend Engineer",
            Description = "Build scalable .NET APIs",
            MinExperienceYears = 3.5m,
            UpdatedAt = new DateTime(2026, 11, 20, 10, 0, 0, DateTimeKind.Utc),
            JobRequirements = new List<JobRequirement>
            {
                new() { RequirementType = "MUST_HAVE", Category = "EXPERIENCE", Content = "Kinh nghiệm phát triển .NET Core" },
                new() { RequirementType = "SHOULD_HAVE", Category = "EDUCATION", Content = "Đại học CNTT" },
                new() { RequirementType = "MUST_HAVE", Category = "SKILL", Content = "PostgreSQL" }
            },
            JobSkills = new List<JobSkill>
            {
                new() { IsMandatory = true, Skill = new Skill { SkillName = "PostgreSQL" } },
                new() { IsMandatory = false, Skill = new Skill { SkillName = "Docker" } }
            }
        };

        var payload = AiIntegrationEndpoints.BuildJobJdPayload(job);

        payload.Requirements.Should().HaveCount(4);
        payload.Requirements[0].Should().BeEquivalentTo(new
        {
            Type = "MUST_HAVE",
            Category = "EXPERIENCE",
            Content = "Kinh nghiệm phát triển .NET Core",
            MinYears = 3.5m
        });
        payload.Requirements[1].MinYears.Should().BeNull();
        payload.Requirements[2].MinYears.Should().BeNull();
        payload.Requirements[3].Should().BeEquivalentTo(new
        {
            Type = "SHOULD_HAVE",
            Category = "SKILL",
            Content = "Docker",
            MinYears = (decimal?)null
        });

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        using var doc = JsonDocument.Parse(json);
        var reqs = doc.RootElement.GetProperty("requirements");
        reqs[0].GetProperty("minYears").GetDecimal().Should().Be(3.5m);
        reqs[1].GetProperty("minYears").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public void BuildJobJdPayload_WhenMinExperienceYearsSetWithoutExperienceRequirement_SynthesizesExperienceRequirement()
    {
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Frontend Engineer",
            MinExperienceYears = 2m,
            UpdatedAt = DateTime.UtcNow,
            JobRequirements = new List<JobRequirement>
            {
                new() { RequirementType = "MUST_HAVE", Category = "SKILL", Content = "React" }
            },
            JobSkills = new List<JobSkill>()
        };

        var payload = AiIntegrationEndpoints.BuildJobJdPayload(job);

        payload.Requirements.Should().HaveCount(2);
        payload.Requirements[0].MinYears.Should().BeNull();
        payload.Requirements[1].Should().BeEquivalentTo(new
        {
            Type = "MUST_HAVE",
            Category = "EXPERIENCE",
            Content = "Tối thiểu 2 năm kinh nghiệm",
            MinYears = 2m
        });
    }

    [Fact]
    public void BuildJobJdPayload_WhenMinExperienceYearsIsNullOrZero_DoesNotSynthesizeOrSetMinYears()
    {
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Fresher Engineer",
            MinExperienceYears = 0m,
            UpdatedAt = DateTime.UtcNow,
            JobRequirements = new List<JobRequirement>
            {
                new() { RequirementType = "SHOULD_HAVE", Category = "EXPERIENCE", Content = "Ưu tiên có kinh nghiệm thực tập" }
            },
            JobSkills = new List<JobSkill>()
        };

        var payload = AiIntegrationEndpoints.BuildJobJdPayload(job);

        payload.Requirements.Should().ContainSingle();
        payload.Requirements[0].MinYears.Should().BeNull();
    }
}
