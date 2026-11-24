using FieldOps.Domain.Enums;

namespace FieldOps.Domain.Entities;

public sealed class WorkOrder
{
    private WorkOrder() { } // EF Core

    public WorkOrder(
        Guid facilityId,
        string code,
        string title,
        string? description,
        WorkOrderPriority priority,
        Guid? assetId = null,
        Guid? incidentId = null,
        Guid? technicianId = null,
        DateTimeOffset? scheduledStartUtc = null,
        DateTimeOffset? dueAtUtc = null)
    {
        ValidateRequiredId(facilityId, nameof(facilityId));
        ValidateOptionalId(assetId, nameof(assetId));
        ValidateOptionalId(incidentId, nameof(incidentId));
        ValidateOptionalId(technicianId, nameof(technicianId));

        var validCode = ValidateRequired(code, nameof(code), 30);
        var validTitle = ValidateRequired(title, nameof(title), 150);
        var validDescription = NormalizeOptional(
            description, nameof(description), 2000);

        ValidatePriority(priority);
        ValidateSchedule(scheduledStartUtc, dueAtUtc);

        var now = DateTimeOffset.UtcNow;

        Id = Guid.NewGuid();
        FacilityId = facilityId;
        AssetId = assetId;
        IncidentId = incidentId;
        TechnicianId = technicianId;

        Code = validCode;
        Title = validTitle;
        Description = validDescription;
        Priority = priority;
        Status = WorkOrderStatus.Planned;

        ScheduledStartUtc = scheduledStartUtc?.ToUniversalTime();
        DueAtUtc = dueAtUtc?.ToUniversalTime();

        CreatedAtUtc = now;
        UpdatedAtUtc = now;
    }

    public Guid Id { get; private set; }

    public Guid FacilityId { get; private set; }
    public Guid? AssetId { get; private set; }
    public Guid? IncidentId { get; private set; }
    public Guid? TechnicianId { get; private set; }

    public string Code { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    public WorkOrderPriority Priority { get; private set; }
    public WorkOrderStatus Status { get; private set; }

    public DateTimeOffset? ScheduledStartUtc { get; private set; }
    public DateTimeOffset? DueAtUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public DateTimeOffset? StartedAtUtc { get; private set; }
    public DateTimeOffset? CompletedAtUtc { get; private set; }
    public DateTimeOffset? CancelledAtUtc { get; private set; }

    public string? CancellationReason { get; private set; }

    public void UpdateDetails(
        string title,
        string? description,
        WorkOrderPriority priority,
        DateTimeOffset? scheduledStartUtc,
        DateTimeOffset? dueAtUtc)
    {
        EnsurePlanned();

        var validTitle = ValidateRequired(
            title, nameof(title), 150);

        var validDescription = NormalizeOptional(
            description, nameof(description), 2000);

        ValidatePriority(priority);
        ValidateSchedule(scheduledStartUtc, dueAtUtc);

        Title = validTitle;
        Description = validDescription;
        Priority = priority;

        ScheduledStartUtc = scheduledStartUtc?.ToUniversalTime();
        DueAtUtc = dueAtUtc?.ToUniversalTime();

        Touch();
    }

    public void AssignTechnician(Guid? technicianId)
    {
        EnsurePlanned();
        ValidateOptionalId(technicianId, nameof(technicianId));

        TechnicianId = technicianId;
        Touch();
    }

    public void Start()
    {
        EnsurePlanned();

        if (!TechnicianId.HasValue)
        {
            throw new InvalidOperationException(
                "A technician must be assigned before starting the work order.");
        }

        var now = DateTimeOffset.UtcNow;

        Status = WorkOrderStatus.InProgress;
        StartedAtUtc = now;
        UpdatedAtUtc = now;
    }

    public void Complete()
    {
        if (Status != WorkOrderStatus.InProgress)
        {
            throw new InvalidOperationException(
                "Only work orders in progress can be completed.");
        }

        var now = DateTimeOffset.UtcNow;

        Status = WorkOrderStatus.Completed;
        CompletedAtUtc = now;
        UpdatedAtUtc = now;
    }

    public void Cancel(string reason)
    {
        if (Status is not (
            WorkOrderStatus.Planned or WorkOrderStatus.InProgress))
        {
            throw new InvalidOperationException(
                "Only planned or in-progress work orders can be cancelled.");
        }

        var validReason = ValidateRequired(
            reason, nameof(reason), 500);

        var now = DateTimeOffset.UtcNow;

        Status = WorkOrderStatus.Cancelled;
        CancellationReason = validReason;
        CancelledAtUtc = now;
        UpdatedAtUtc = now;
    }

    private void EnsurePlanned()
    {
        if (Status != WorkOrderStatus.Planned)
        {
            throw new InvalidOperationException(
                "Only planned work orders can be modified or started.");
        }
    }

    private void Touch()
    {
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    private static void ValidateRequiredId(
        Guid id,
        string parameterName)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException(
                $"{parameterName} is required.",
                parameterName);
        }
    }

    private static void ValidateOptionalId(
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

    private static string ValidateRequired(
        string value,
        string parameterName,
        int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(
                $"{parameterName} is required.",
                parameterName);
        }

        var trimmed = value.Trim();

        if (trimmed.Length > maxLength)
        {
            throw new ArgumentException(
                $"{parameterName} cannot exceed {maxLength} characters.",
                parameterName);
        }

        return trimmed;
    }

    private static string? NormalizeOptional(
        string? value,
        string parameterName,
        int maxLength)
    {
        var trimmed = value?.Trim();

        if (trimmed?.Length > maxLength)
        {
            throw new ArgumentException(
                $"{parameterName} cannot exceed {maxLength} characters.",
                parameterName);
        }

        return string.IsNullOrWhiteSpace(trimmed)
            ? null
            : trimmed;
    }

    private static void ValidatePriority(WorkOrderPriority priority)
    {
        if (!Enum.IsDefined(priority))
        {
            throw new ArgumentOutOfRangeException(
                nameof(priority),
                "Invalid work order priority.");
        }
    }

    private static void ValidateSchedule(
        DateTimeOffset? scheduledStartUtc,
        DateTimeOffset? dueAtUtc)
    {
        if (scheduledStartUtc.HasValue &&
            dueAtUtc.HasValue &&
            dueAtUtc.Value < scheduledStartUtc.Value)
        {
            throw new ArgumentException(
                "Due date cannot be earlier than scheduled start.",
                nameof(dueAtUtc));
        }
    }
}
