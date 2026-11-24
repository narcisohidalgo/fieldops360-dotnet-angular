using FieldOps.Domain.Enums;

namespace FieldOps.Application.WorkOrders;

public interface IWorkOrderService
{
    Task<IReadOnlyList<WorkOrderDto>> GetAllAsync(
        Guid? facilityId = null,
        Guid? assetId = null,
        Guid? incidentId = null,
        Guid? technicianId = null,
        WorkOrderStatus? status = null,
        WorkOrderPriority? priority = null,
        CancellationToken cancellationToken = default);

    Task<WorkOrderDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<WorkOrderDto> CreateAsync(
        CreateWorkOrderCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(
        Guid id,
        UpdateWorkOrderCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> AssignTechnicianAsync(
        Guid id,
        Guid? technicianId,
        CancellationToken cancellationToken = default);

    Task<bool> StartAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> CompleteAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> CancelAsync(
        Guid id,
        string reason,
        CancellationToken cancellationToken = default);
}
