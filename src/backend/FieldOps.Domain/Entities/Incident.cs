using FieldOps.Domain.Enums;

namespace FieldOps.Domain.Entities;

public sealed class Incident
{
    private Incident() { } // EF Core

    public Incident(
        Guid facilityId,
        string title,
        string? description,
        IncidentPriority priority,
        Guid? assetId = null)
    {
        if (facilityId == Guid.Empty)
        {
            throw new ArgumentException(
                "Facility ID is required.",
                nameof(facilityId));
        }

        if (assetId == Guid.Empty)
        {
            throw new ArgumentException(
                "Asset ID cannot be empty.",
                nameof(assetId));
        }

        var validatedTitle = ValidateTitle(title);
        var validatedDescription = NormalizeDescription(description);

        ValidatePriority(priority);

        Id = Guid.NewGuid();
        FacilityId = facilityId;
        AssetId = assetId;
        Title = validatedTitle;
        Description = validatedDescription;
        Priority = priority;
        Status = IncidentStatus.Open;

        CreatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }

    public Guid Id { get; private set; }
    public Guid FacilityId { get; private set; }
    public Guid? AssetId { get; private set; }

    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    public IncidentPriority Priority { get; private set; }
    public IncidentStatus Status { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public DateTimeOffset? ResolvedAtUtc { get; private set; }
    public DateTimeOffset? ClosedAtUtc { get; private set; }

    public void UpdateDetails(
        string title,
        string? description,
        IncidentPriority priority)
    {
        if (Status is IncidentStatus.Resolved or IncidentStatus.Closed)
        {
            throw new InvalidOperationException(
                "Resolved or closed incidents must be reopened before editing.");
        }

        var validatedTitle = ValidateTitle(title);
        var validatedDescription = NormalizeDescription(description);

        ValidatePriority(priority);

        Title = validatedTitle;
        Description = validatedDescription;
        Priority = priority;

        Touch();
    }

    public void StartProgress()
    {
        if (Status != IncidentStatus.Open)
        {
            throw new InvalidOperationException(
                "Only open incidents can be started.");
        }

        Status = IncidentStatus.InProgress;
        Touch();
    }

    public void Resolve()
    {
        if (Status != IncidentStatus.InProgress)
        {
            throw new InvalidOperationException(
                "Only incidents in progress can be resolved.");
        }

        var now = DateTimeOffset.UtcNow;

        Status = IncidentStatus.Resolved;
        ResolvedAtUtc = now;
        UpdatedAtUtc = now;
    }

    public void Close()
    {
        if (Status != IncidentStatus.Resolved)
        {
            throw new InvalidOperationException(
                "Only resolved incidents can be closed.");
        }

        var now = DateTimeOffset.UtcNow;

        Status = IncidentStatus.Closed;
        ClosedAtUtc = now;
        UpdatedAtUtc = now;
    }

    public void Reopen()
    {
        if (Status is not (
            IncidentStatus.Resolved or IncidentStatus.Closed))
        {
            throw new InvalidOperationException(
                "Only resolved or closed incidents can be reopened.");
        }

        Status = IncidentStatus.Open;

        ResolvedAtUtc = null;
        ClosedAtUtc = null;

        Touch();
    }

    private void Touch()
    {
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    private static string ValidateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException(
                "Title is required.",
                nameof(title));
        }

        var trimmed = title.Trim();

        if (trimmed.Length > 150)
        {
            throw new ArgumentException(
                "Title cannot exceed 150 characters.",
                nameof(title));
        }

        return trimmed;
    }

    private static string? NormalizeDescription(string? description)
    {
        var trimmed = description?.Trim();

        if (trimmed?.Length > 2000)
        {
            throw new ArgumentException(
                "Description cannot exceed 2000 characters.",
                nameof(description));
        }

        return string.IsNullOrWhiteSpace(trimmed)
            ? null
            : trimmed;
    }

    private static void ValidatePriority(IncidentPriority priority)
    {
        if (!Enum.IsDefined(priority))
        {
            throw new ArgumentOutOfRangeException(
                nameof(priority),
                "Invalid incident priority.");
        }
    }
}
