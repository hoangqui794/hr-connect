using System;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypeDetail;

public record GetServiceTypeDetailQuery(Guid Id) : IRequest<GetServiceTypeDetailResponse>;

public class GetServiceTypeDetailResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy chi tiết loại dịch vụ thành công.";

    public ServiceTypeDto? Data { get; set; }
}
