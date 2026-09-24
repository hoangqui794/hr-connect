using System;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.DeleteCandidateCv;

public record DeleteCandidateCvCommand(Guid CvId, Guid UserId) : IRequest<DeleteCandidateCvResponse>;

public class DeleteCandidateCvResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Xóa CV thành công.";
}
