using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;
using HRConnect.Application.Features.Candidates.Commands.RemoveCandidateSkill;
using HRConnect.Application.Features.Candidates.Commands.ReplaceCandidateSkills;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateSkill;
using HRConnect.Application.Features.Candidates.Common;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class CandidateSkillCommandHandlerTests
{
    [Fact]
    public async Task Add_WhenSkillIsActiveAndNotOwned_AddsSkill()
    {
        var userId = Guid.NewGuid();
        var skill = NewSkill("C#");
        var candidate = NewCandidate(userId);
        var candidates = CandidateRepositoryFor(candidate, userId);
        var skills = new Mock<ISkillRepository>();
        skills.Setup(repository => repository.GetActiveByIdsAsync(
                It.Is<IReadOnlyCollection<Guid>>(ids => ids.Contains(skill.SkillId)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Skill> { [skill.SkillId] = skill });
        var unitOfWork = UnitOfWork();
        var handler = new AddCandidateSkillCommandHandler(candidates.Object, skills.Object, unitOfWork.Object);

        var result = await handler.Handle(new AddCandidateSkillCommand
        {
            UserId = userId,
            SkillId = skill.SkillId,
            ProficiencyLevel = "advanced",
            YearsOfExperience = 3.5m
        }, CancellationToken.None);

        result.Data.SkillName.Should().Be("C#");
        result.Data.ProficiencyLevel.Should().Be("ADVANCED");
        candidate.CandidateSkills.Should().ContainSingle(item => item.SkillId == skill.SkillId);
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Add_WhenSkillAlreadyExists_ThrowsConflict()
    {
        var userId = Guid.NewGuid();
        var skill = NewSkill("SQL");
        var candidate = NewCandidate(userId, skill);
        var handler = new AddCandidateSkillCommandHandler(
            CandidateRepositoryFor(candidate, userId).Object,
            Mock.Of<ISkillRepository>(),
            UnitOfWork().Object);

        var action = () => handler.Handle(new AddCandidateSkillCommand { UserId = userId, SkillId = skill.SkillId }, CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Add_WhenCandidateAlreadyHasFiftySkills_DoesNotSave()
    {
        var userId = Guid.NewGuid();
        var candidate = NewCandidate(userId);
        for (var index = 0; index < 50; index++)
        {
            var skill = NewSkill($"Skill {index}");
            candidate.CandidateSkills.Add(new CandidateSkill
            {
                CandidateId = candidate.CandidateId,
                SkillId = skill.SkillId,
                Skill = skill
            });
        }

        var unitOfWork = UnitOfWork();
        var handler = new AddCandidateSkillCommandHandler(
            CandidateRepositoryFor(candidate, userId).Object,
            Mock.Of<ISkillRepository>(),
            unitOfWork.Object);

        var action = () => handler.Handle(new AddCandidateSkillCommand
        {
            UserId = userId,
            SkillId = Guid.NewGuid()
        }, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*tối đa 50 kỹ năng*");
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Update_WhenSkillBelongsToCandidate_UpdatesItsMetadata()
    {
        var userId = Guid.NewGuid();
        var skill = NewSkill("Azure");
        var candidate = NewCandidate(userId, skill, "BEGINNER", 1);
        var unitOfWork = UnitOfWork();
        var handler = new UpdateCandidateSkillCommandHandler(CandidateRepositoryFor(candidate, userId).Object, unitOfWork.Object);

        var result = await handler.Handle(new UpdateCandidateSkillCommand
        {
            UserId = userId,
            SkillId = skill.SkillId,
            ProficiencyLevel = "expert",
            YearsOfExperience = 6
        }, CancellationToken.None);

        result.Data.ProficiencyLevel.Should().Be("EXPERT");
        result.Data.YearsOfExperience.Should().Be(6);
        candidate.CandidateSkills.Single().ProficiencyLevel.Should().Be("EXPERT");
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Remove_WhenSkillBelongsToCandidate_RemovesSkill()
    {
        var userId = Guid.NewGuid();
        var skill = NewSkill("Docker");
        var candidate = NewCandidate(userId, skill);
        var unitOfWork = UnitOfWork();
        var handler = new RemoveCandidateSkillCommandHandler(CandidateRepositoryFor(candidate, userId).Object, unitOfWork.Object);

        var result = await handler.Handle(new RemoveCandidateSkillCommand { UserId = userId, SkillId = skill.SkillId }, CancellationToken.None);

        result.Success.Should().BeTrue();
        candidate.CandidateSkills.Should().BeEmpty();
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Replace_WhenEverySkillIsActive_ReplacesExistingSkillsAtomically()
    {
        var userId = Guid.NewGuid();
        var oldSkill = NewSkill("PHP");
        var newSkill = NewSkill("C#");
        var candidate = NewCandidate(userId, oldSkill);
        var candidates = CandidateRepositoryFor(candidate, userId);
        var skills = new Mock<ISkillRepository>();
        skills.Setup(repository => repository.GetActiveByIdsAsync(
                It.IsAny<IReadOnlyCollection<Guid>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Skill> { [newSkill.SkillId] = newSkill });
        var unitOfWork = UnitOfWork();
        var handler = new ReplaceCandidateSkillsCommandHandler(candidates.Object, skills.Object, unitOfWork.Object);

        var result = await handler.Handle(new ReplaceCandidateSkillsCommand
        {
            UserId = userId,
            Skills = [new CandidateSkillInput(newSkill.SkillId, "INTERMEDIATE", 2)]
        }, CancellationToken.None);

        result.Data.Should().ContainSingle(item => item.SkillId == newSkill.SkillId);
        candidate.CandidateSkills.Should().ContainSingle(item => item.SkillId == newSkill.SkillId);
        candidate.CandidateSkills.Should().NotContain(item => item.SkillId == oldSkill.SkillId);
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Replace_WhenARequestedSkillIsInactiveOrMissing_DoesNotSave()
    {
        var userId = Guid.NewGuid();
        var candidate = NewCandidate(userId);
        var skills = new Mock<ISkillRepository>();
        skills.Setup(repository => repository.GetActiveByIdsAsync(
                It.IsAny<IReadOnlyCollection<Guid>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Skill>());
        var unitOfWork = UnitOfWork();
        var handler = new ReplaceCandidateSkillsCommandHandler(
            CandidateRepositoryFor(candidate, userId).Object,
            skills.Object,
            unitOfWork.Object);

        var action = () => handler.Handle(new ReplaceCandidateSkillsCommand
        {
            UserId = userId,
            Skills = [new CandidateSkillInput(Guid.NewGuid(), null, null)]
        }, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private static Mock<ICandidateRepository> CandidateRepositoryFor(Candidate candidate, Guid userId)
    {
        var repository = new Mock<ICandidateRepository>();
        repository.Setup(item => item.GetByUserIdWithSkillsForUpdateAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);
        return repository;
    }

    private static Mock<IUnitOfWork> UnitOfWork()
    {
        var unitOfWork = new Mock<IUnitOfWork>();
        unitOfWork.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return unitOfWork;
    }

    private static Candidate NewCandidate(Guid userId, Skill? skill = null, string? proficiency = null, decimal? years = null)
    {
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            FullName = "Candidate Test",
            Status = "ACTIVE",
            ProfileVisibility = "PRIVATE"
        };

        if (skill != null)
        {
            candidate.CandidateSkills.Add(new CandidateSkill
            {
                CandidateId = candidate.CandidateId,
                SkillId = skill.SkillId,
                Skill = skill,
                ProficiencyLevel = proficiency,
                YearsOfExperience = years
            });
        }

        return candidate;
    }

    private static Skill NewSkill(string name) => new()
    {
        SkillId = Guid.NewGuid(),
        SkillName = name,
        NormalizedName = name.ToUpperInvariant(),
        IsActive = true
    };
}
