using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Tests.Incidents;

public sealed class IncidentStateTests
{
    [Fact]
    public void StartProgress_FromOpen_SetsInProgress()
    {
        var incident = CreateIncident();

        var createdAt = incident.CreatedAtUtc;

        incident.StartProgress();

        Assert.Equal(IncidentStatus.InProgress, incident.Status);
        Assert.True(incident.UpdatedAtUtc >= createdAt);
        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);
    }

    [Fact]
    public void Resolve_FromInProgress_SetsResolutionDate()
    {
        var incident = CreateIncidentAtStatus(
            IncidentStatus.InProgress);

        var previousUpdatedAt = incident.UpdatedAtUtc;

        incident.Resolve();

        Assert.Equal(IncidentStatus.Resolved, incident.Status);

        Assert.NotNull(incident.ResolvedAtUtc);
        Assert.Equal(
            incident.UpdatedAtUtc,
            incident.ResolvedAtUtc);

        Assert.True(
            incident.UpdatedAtUtc >= previousUpdatedAt);

        Assert.Null(incident.ClosedAtUtc);
    }

    [Fact]
    public void Close_FromResolved_SetsClosingDate()
    {
        var incident = CreateIncidentAtStatus(
            IncidentStatus.Resolved);

        var originalResolvedAt = incident.ResolvedAtUtc;

        incident.Close();

        Assert.Equal(IncidentStatus.Closed, incident.Status);

        Assert.NotNull(incident.ClosedAtUtc);
        Assert.Equal(
            incident.UpdatedAtUtc,
            incident.ClosedAtUtc);

        Assert.Equal(
            originalResolvedAt,
            incident.ResolvedAtUtc);

        Assert.True(
            incident.ClosedAtUtc >= incident.ResolvedAtUtc);
    }

    [Fact]
    public void Reopen_FromResolved_ReturnsToOpen()
    {
        var incident = CreateIncidentAtStatus(
            IncidentStatus.Resolved);

        var previousUpdatedAt = incident.UpdatedAtUtc;

        incident.Reopen();

        Assert.Equal(IncidentStatus.Open, incident.Status);
        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);

        Assert.True(
            incident.UpdatedAtUtc >= previousUpdatedAt);
    }

    [Fact]
    public void Reopen_FromClosed_ReturnsToOpen()
    {
        var incident = CreateIncidentAtStatus(
            IncidentStatus.Closed);

        var previousUpdatedAt = incident.UpdatedAtUtc;

        incident.Reopen();

        Assert.Equal(IncidentStatus.Open, incident.Status);
        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);

        Assert.True(
            incident.UpdatedAtUtc >= previousUpdatedAt);
    }

    [Fact]
    public void UpdateDetails_WhileInProgress_IsAllowed()
    {
        var incident = CreateIncidentAtStatus(
            IncidentStatus.InProgress);

        incident.UpdateDetails(
            "Averia mecanica actualizada",
            "El equipo necesita reparacion",
            IncidentPriority.Critical);

        Assert.Equal(
            "Averia mecanica actualizada",
            incident.Title);

        Assert.Equal(
            "El equipo necesita reparacion",
            incident.Description);

        Assert.Equal(
            IncidentPriority.Critical,
            incident.Priority);

        Assert.Equal(
            IncidentStatus.InProgress,
            incident.Status);

        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);
    }

    [Fact]
    public void FullLifecycle_ReopenAndResolveAgain_Succeeds()
    {
        var incident = CreateIncident();

        var originalId = incident.Id;
        var originalFacilityId = incident.FacilityId;
        var originalAssetId = incident.AssetId;
        var originalCreatedAt = incident.CreatedAtUtc;

        incident.StartProgress();
        incident.Resolve();
        incident.Close();

        Assert.Equal(IncidentStatus.Closed, incident.Status);
        Assert.NotNull(incident.ResolvedAtUtc);
        Assert.NotNull(incident.ClosedAtUtc);

        incident.Reopen();

        Assert.Equal(IncidentStatus.Open, incident.Status);
        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);

        incident.StartProgress();
        incident.Resolve();

        Assert.Equal(IncidentStatus.Resolved, incident.Status);
        Assert.NotNull(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);

        incident.Close();

        Assert.Equal(IncidentStatus.Closed, incident.Status);
        Assert.NotNull(incident.ClosedAtUtc);

        Assert.Equal(originalId, incident.Id);
        Assert.Equal(originalFacilityId, incident.FacilityId);
        Assert.Equal(originalAssetId, incident.AssetId);
        Assert.Equal(originalCreatedAt, incident.CreatedAtUtc);
    }

    [Theory]
    [InlineData(IncidentStatus.InProgress)]
    [InlineData(IncidentStatus.Resolved)]
    [InlineData(IncidentStatus.Closed)]
    public void StartProgress_FromInvalidStatus_ThrowsAndPreservesState(
        IncidentStatus status)
    {
        var incident = CreateIncidentAtStatus(status);

        AssertRejectedTransitionDoesNotMutate(
            incident,
            incident.StartProgress);
    }

    [Theory]
    [InlineData(IncidentStatus.Open)]
    [InlineData(IncidentStatus.Resolved)]
    [InlineData(IncidentStatus.Closed)]
    public void Resolve_FromInvalidStatus_ThrowsAndPreservesState(
        IncidentStatus status)
    {
        var incident = CreateIncidentAtStatus(status);

        AssertRejectedTransitionDoesNotMutate(
            incident,
            incident.Resolve);
    }

    [Theory]
    [InlineData(IncidentStatus.Open)]
    [InlineData(IncidentStatus.InProgress)]
    [InlineData(IncidentStatus.Closed)]
    public void Close_FromInvalidStatus_ThrowsAndPreservesState(
        IncidentStatus status)
    {
        var incident = CreateIncidentAtStatus(status);

        AssertRejectedTransitionDoesNotMutate(
            incident,
            incident.Close);
    }

    [Theory]
    [InlineData(IncidentStatus.Open)]
    [InlineData(IncidentStatus.InProgress)]
    public void Reopen_FromInvalidStatus_ThrowsAndPreservesState(
        IncidentStatus status)
    {
        var incident = CreateIncidentAtStatus(status);

        AssertRejectedTransitionDoesNotMutate(
            incident,
            incident.Reopen);
    }

    [Theory]
    [InlineData(IncidentStatus.Resolved)]
    [InlineData(IncidentStatus.Closed)]
    public void UpdateDetails_FromFinalStatus_ThrowsAndPreservesFields(
        IncidentStatus status)
    {
        var incident = CreateIncidentAtStatus(status);

        var before = (
            incident.Title,
            incident.Description,
            incident.Priority,
            incident.Status,
            incident.UpdatedAtUtc,
            incident.ResolvedAtUtc,
            incident.ClosedAtUtc
        );

        Assert.Throws<InvalidOperationException>(
            () => incident.UpdateDetails(
                "Titulo modificado",
                "Descripcion modificada",
                IncidentPriority.Low));

        var after = (
            incident.Title,
            incident.Description,
            incident.Priority,
            incident.Status,
            incident.UpdatedAtUtc,
            incident.ResolvedAtUtc,
            incident.ClosedAtUtc
        );

        Assert.Equal(before, after);
    }

    private static void AssertRejectedTransitionDoesNotMutate(
        Incident incident,
        Action action)
    {
        var before = (
            incident.Status,
            incident.UpdatedAtUtc,
            incident.ResolvedAtUtc,
            incident.ClosedAtUtc
        );

        Assert.Throws<InvalidOperationException>(action);

        var after = (
            incident.Status,
            incident.UpdatedAtUtc,
            incident.ResolvedAtUtc,
            incident.ClosedAtUtc
        );

        Assert.Equal(before, after);
    }

    private static Incident CreateIncident()
    {
        return new Incident(
            Guid.NewGuid(),
            "Fallo en equipo",
            "El equipo no funciona correctamente",
            IncidentPriority.High,
            Guid.NewGuid());
    }

    private static Incident CreateIncidentAtStatus(
        IncidentStatus status)
    {
        var incident = CreateIncident();

        switch (status)
        {
            case IncidentStatus.Open:
                break;

            case IncidentStatus.InProgress:
                incident.StartProgress();
                break;

            case IncidentStatus.Resolved:
                incident.StartProgress();
                incident.Resolve();
                break;

            case IncidentStatus.Closed:
                incident.StartProgress();
                incident.Resolve();
                incident.Close();
                break;

            default:
                throw new ArgumentOutOfRangeException(
                    nameof(status));
        }

        return incident;
    }
}
