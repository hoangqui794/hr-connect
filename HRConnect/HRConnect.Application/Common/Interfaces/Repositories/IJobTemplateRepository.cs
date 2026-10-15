using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IJobTemplateRepository
{
    /// <summary>
    /// Templates whose search text contains every token (tokens are already lower-cased and accent-free),
    /// with their requirements, untracked. Empty tokens = all templates.
    /// </summary>
    Task<IReadOnlyList<JobTemplate>> SearchAsync(
        IReadOnlyCollection<string> tokens, string? industry, bool? isActive, CancellationToken cancellationToken = default);

    /// <summary>Template with its requirements; tracked so handlers can update it.</summary>
    Task<JobTemplate?> GetByIdAsync(Guid templateId, CancellationToken cancellationToken = default);

    Task<bool> CodeExistsAsync(string code, Guid? exceptTemplateId, CancellationToken cancellationToken = default);

    Task AddAsync(JobTemplate template, CancellationToken cancellationToken = default);

    /// <summary>Deletes the old requirement rows and inserts the new ones (explicitly as new rows).</summary>
    void ReplaceRequirements(IEnumerable<JobTemplateRequirement> oldRequirements, IEnumerable<JobTemplateRequirement> newRequirements);
}
