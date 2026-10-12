using System;
using System.Collections.Generic;
using HRConnect.Application.Features.Jobs.Common;

namespace HRConnect.Application.Features.Candidates.SavedJobs.DTOs;

public sealed record SavedJobDto(
    Guid SavedJobId,
    DateTime SavedAt,
    JobListItemDto Job);

public sealed record SavedJobPageDto(
    IReadOnlyList<SavedJobDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public sealed record SaveJobResponse(
    bool Success,
    string Message,
    Guid? SavedJobId = null);
