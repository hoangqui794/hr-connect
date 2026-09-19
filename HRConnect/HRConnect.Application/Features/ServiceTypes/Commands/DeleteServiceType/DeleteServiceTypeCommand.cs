using System;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Commands.DeleteServiceType;

public record DeleteServiceTypeCommand(Guid Id) : IRequest<DeleteServiceTypeResponse>;

public class DeleteServiceTypeResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = string.Empty;

    public bool IsDeactivated { get; set; }
}
