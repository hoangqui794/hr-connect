using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypeDetail;

public class GetServiceTypeDetailQueryHandler : IRequestHandler<GetServiceTypeDetailQuery, GetServiceTypeDetailResponse>
{
    private readonly IServiceTypeRepository _serviceTypeRepository;

    public GetServiceTypeDetailQueryHandler(IServiceTypeRepository serviceTypeRepository)
    {
        _serviceTypeRepository = serviceTypeRepository;
    }

    public async Task<GetServiceTypeDetailResponse> Handle(GetServiceTypeDetailQuery request, CancellationToken cancellationToken)
    {
        var serviceType = await _serviceTypeRepository.GetByIdAsync(request.Id, cancellationToken);
        if (serviceType == null)
        {
            throw new NotFoundException($"Không tìm thấy loại dịch vụ với ID: {request.Id}");
        }

        var dto = new ServiceTypeDto
        {
            Id = serviceType.ServiceTypeId,
            Code = serviceType.Code,
            Name = serviceType.Name,
            Description = serviceType.Description,
            IsActive = serviceType.IsActive,
            CreatedAt = serviceType.CreatedAt,
            UpdatedAt = serviceType.UpdatedAt
        };

        return new GetServiceTypeDetailResponse
        {
            Success = true,
            Message = "Lấy chi tiết loại dịch vụ thành công.",
            Data = dto
        };
    }
}
