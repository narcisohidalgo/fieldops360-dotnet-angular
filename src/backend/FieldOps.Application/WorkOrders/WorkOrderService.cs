using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.WorkOrders;

public sealed class WorkOrderService : IWorkOrderService
{
    private readonly IWorkOrderRepository _workOrders;
    private readonly IFacilityRepository _facilities;
    private readonly IAssetRepository _assets;
    private readonly IIncidentRepository _incidents;
    private readonly ITechnicianRepository _technicians;

    public WorkOrderService(
        IWorkOrderRepository workOrders,
        IFacilityRepository facilities,
        IAssetRepository assets,
        IIncidentRepository incidents,
        ITechnicianRepository technicians)
    {
        _workOrders = workOrders;
        _facilities = facilities;
        _assets = assets;
        _incidents = incidents;
        _technicians = technicians;
    }

    public async Task<IReadOnlyList<WorkOrderDto>> GetAllAsync(
        Guid? facilityId = null,
        Guid? assetId = null,
        Guid? incidentId = null,
        Guid? technicianId = null,
        WorkOrderStatus? status = null,
        WorkOrderPriority? priority = null,
        CancellationToken cancellationToken = default)
    {
        ValidateFilterId(facilityId, nameof(facilityId));
        ValidateFilterId(assetId, nameof(assetId));
        ValidateFilterId(incidentId, nameof(incidentId));
        ValidateFilterId(technicianId, nameof(technicianId));

        if (status.HasValue && !Enum.IsDefined(status.Value))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        if (priority.HasValue && !Enum.IsDefined(priority.Value))
        {
            throw new ArgumentOutOfRangeException(nameof(priority));
        }

        var orders = await _workOrders.GetAllAsync(
            facilityId,
            assetId,
            incidentId,
            technicianId,
            status,
            priority,
            cancellationToken);

        return orders.Select(ToDto).ToList();
    }

    public async Task<WorkOrderDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var order = await _workOrders.GetByIdAsync(
            id, cancellationToken);

        return order is null ? null : ToDto(order);
    }

    public async Task<WorkOrderDto> CreateAsync(
        CreateWorkOrderCommand command,
        CancellationToken cancellationToken = default)
    {
        // Domain validates all local fields before database queries.
        var order = new WorkOrder(
            command.FacilityId,
            command.Code,
            command.Title,
            command.Description,
            command.Priority,
            command.AssetId,
            command.IncidentId,
            command.TechnicianId,
            command.ScheduledStartUtc,
            command.DueAtUtc);

        if (await _workOrders.ExistsByCodeAsync(
            order.Code, cancellationToken))
        {
            throw new DuplicateWorkOrderCodeException(order.Code);
        }

        await ValidateReferencesAsync(
            order,
            cancellationToken);

        await _workOrders.AddAsync(order, cancellationToken);
        await _workOrders.SaveChangesAsync(cancellationToken);

        return ToDto(order);
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateWorkOrderCommand command,
        CancellationToken cancellationToken = default)
    {
        var order = await _workOrders.GetByIdAsync(
            id, cancellationToken);

        if (order is null)
        {
            return false;
        }

        order.UpdateDetails(
            command.Title,
            command.Description,
            command.Priority,
            command.ScheduledStartUtc,
            command.DueAtUtc);

        await _workOrders.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> AssignTechnicianAsync(
        Guid id,
        Guid? technicianId,
        CancellationToken cancellationToken = default)
    {
        var order = await _workOrders.GetByIdAsync(
            id, cancellationToken);

        if (order is null)
        {
            return false;
        }

        if (order.Status != WorkOrderStatus.Planned)
        {
            throw new InvalidOperationException(
                "Only planned work orders can change technician assignment.");
        }

        if (technicianId == Guid.Empty)
        {
            throw new ArgumentException(
                "Technician ID cannot be empty.",
                nameof(technicianId));
        }

        if (technicianId.HasValue)
        {
            await ValidateTechnicianAsync(
                technicianId.Value, cancellationToken);
        }

        order.AssignTechnician(technicianId);

        await _workOrders.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> StartAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var order = await _workOrders.GetByIdAsync(
            id, cancellationToken);

        if (order is null)
        {
            return false;
        }

        // Starting requires a currently active technician.
        if (order.Status == WorkOrderStatus.Planned &&
            order.TechnicianId.HasValue)
        {
            await ValidateTechnicianAsync(
                order.TechnicianId.Value,
                cancellationToken);
        }

        // Domain also rejects an unassigned or non-planned order.
        order.Start();

        await _workOrders.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> CompleteAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var order = await _workOrders.GetByIdAsync(
            id, cancellationToken);

        if (order is null)
        {
            return false;
        }

        order.Complete();

        await _workOrders.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> CancelAsync(
        Guid id,
        string reason,
        CancellationToken cancellationToken = default)
    {
        var order = await _workOrders.GetByIdAsync(
            id, cancellationToken);

        if (order is null)
        {
            return false;
        }

        order.Cancel(reason);

        await _workOrders.SaveChangesAsync(cancellationToken);

        return true;
    }

    private async Task ValidateReferencesAsync(
        WorkOrder order,
        CancellationToken cancellationToken)
    {
        var facility = await _facilities.GetByIdAsync(
            order.FacilityId, cancellationToken);

        if (facility is null)
        {
            throw new WorkOrderReferenceException(
                WorkOrderReferenceError.FacilityNotFound,
                $"Facility '{order.FacilityId}' was not found.");
        }

        if (order.AssetId.HasValue)
        {
            var asset = await _assets.GetByIdAsync(
                order.AssetId.Value, cancellationToken);

            if (asset is null)
            {
                throw new WorkOrderReferenceException(
                    WorkOrderReferenceError.AssetNotFound,
                    $"Asset '{order.AssetId}' was not found.");
            }

            if (asset.FacilityId != order.FacilityId)
            {
                throw new WorkOrderReferenceException(
                    WorkOrderReferenceError.AssetFacilityMismatch,
                    "Asset does not belong to the work order facility.");
            }
        }

        if (order.IncidentId.HasValue)
        {
            var incident = await _incidents.GetByIdAsync(
                order.IncidentId.Value, cancellationToken);

            if (incident is null)
            {
                throw new WorkOrderReferenceException(
                    WorkOrderReferenceError.IncidentNotFound,
                    $"Incident '{order.IncidentId}' was not found.");
            }

            if (incident.FacilityId != order.FacilityId)
            {
                throw new WorkOrderReferenceException(
                    WorkOrderReferenceError.IncidentFacilityMismatch,
                    "Incident does not belong to the work order facility.");
            }

            if (order.AssetId.HasValue &&
                incident.AssetId.HasValue &&
                order.AssetId.Value != incident.AssetId.Value)
            {
                throw new WorkOrderReferenceException(
                    WorkOrderReferenceError.IncidentAssetMismatch,
                    "Incident and work order refer to different assets.");
            }
        }

        if (order.TechnicianId.HasValue)
        {
            await ValidateTechnicianAsync(
                order.TechnicianId.Value, cancellationToken);
        }
    }

    private async Task ValidateTechnicianAsync(
        Guid technicianId,
        CancellationToken cancellationToken)
    {
        var technician = await _technicians.GetByIdAsync(
            technicianId, cancellationToken);

        if (technician is null)
        {
            throw new WorkOrderReferenceException(
                WorkOrderReferenceError.TechnicianNotFound,
                $"Technician '{technicianId}' was not found.");
        }

        if (!technician.IsActive)
        {
            throw new WorkOrderReferenceException(
                WorkOrderReferenceError.TechnicianInactive,
                $"Technician '{technicianId}' is inactive.");
        }
    }

    private static void ValidateFilterId(
        Guid? id,
        string parameterName)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException(
                $"{parameterName} cannot be empty.",
                parameterName);
        }
    }

    private static WorkOrderDto ToDto(WorkOrder order)
    {
        return new WorkOrderDto(
            order.Id,
            order.FacilityId,
            order.AssetId,
            order.IncidentId,
            order.TechnicianId,
            order.Code,
            order.Title,
            order.Description,
            order.Priority,
            order.Status,
            order.ScheduledStartUtc,
            order.DueAtUtc,
            order.CreatedAtUtc,
            order.UpdatedAtUtc,
            order.StartedAtUtc,
            order.CompletedAtUtc,
            order.CancelledAtUtc,
            order.CancellationReason);
    }
}
