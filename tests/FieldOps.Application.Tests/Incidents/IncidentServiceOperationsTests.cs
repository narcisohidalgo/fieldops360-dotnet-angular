using FieldOps.Application.Incidents;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Tests.Incidents;

public sealed partial class IncidentServiceTests
{
    [Fact]
    public async Task GetAllAsync_ReturnsAllIncidents()
    {
        var test = new TestContext();

        var first = CreateIncidentForTest(
            Guid.NewGuid(), "Fallo electrico");

        var second = CreateIncidentForTest(
            Guid.NewGuid(), "Averia mecanica");

        test.Incidents.Items.AddRange([first, second]);

        var result = await test.Service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, i => i.Id == first.Id);
        Assert.Contains(result, i => i.Id == second.Id);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task GetAllAsync_FiltersByFacility()
    {
        var test = new TestContext();

        var facilityOne = Guid.NewGuid();
        var facilityTwo = Guid.NewGuid();

        var matching = CreateIncidentForTest(
            facilityOne, "Fallo uno");

        var other = CreateIncidentForTest(
            facilityTwo, "Fallo dos");

        test.Incidents.Items.AddRange([matching, other]);

        var result = await test.Service.GetAllAsync(
            facilityId: facilityOne);

        var found = Assert.Single(result);

        Assert.Equal(matching.Id, found.Id);
        Assert.Equal(facilityOne, found.FacilityId);
    }

    [Fact]
    public async Task GetAllAsync_FiltersByAsset()
    {
        var test = new TestContext();

        var facilityId = Guid.NewGuid();
        var assetId = Guid.NewGuid();

        var matching = CreateIncidentForTest(
            facilityId, "Sensor averiado", assetId: assetId);

        var other = CreateIncidentForTest(
            facilityId, "Problema general");

        test.Incidents.Items.AddRange([matching, other]);

        var result = await test.Service.GetAllAsync(
            assetId: assetId);

        var found = Assert.Single(result);

        Assert.Equal(matching.Id, found.Id);
        Assert.Equal(assetId, found.AssetId);
    }

    [Fact]
    public async Task GetAllAsync_FiltersByStatusAndPriority()
    {
        var test = new TestContext();

        var facilityId = Guid.NewGuid();

        var matching = CreateIncidentForTest(
            facilityId,
            "Incidencia critica",
            IncidentPriority.Critical);

        matching.StartProgress();

        var other = CreateIncidentForTest(
            facilityId,
            "Incidencia normal",
            IncidentPriority.Medium);

        test.Incidents.Items.AddRange([matching, other]);

        var result = await test.Service.GetAllAsync(
            status: IncidentStatus.InProgress,
            priority: IncidentPriority.Critical);

        var found = Assert.Single(result);

        Assert.Equal(matching.Id, found.Id);
        Assert.Equal(IncidentStatus.InProgress, found.Status);
        Assert.Equal(IncidentPriority.Critical, found.Priority);
    }

    [Fact]
    public async Task GetAllAsync_WithInvalidStatus_ThrowsException()
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => test.Service.GetAllAsync(
                status: (IncidentStatus)99));
    }

    [Fact]
    public async Task GetAllAsync_WithInvalidPriority_ThrowsException()
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => test.Service.GetAllAsync(
                priority: (IncidentPriority)99));
    }

    [Fact]
    public async Task GetByIdAsync_WithExistingIncident_ReturnsDto()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(),
            "Averia de tractor",
            IncidentPriority.High);

        test.Incidents.Items.Add(incident);

        var result = await test.Service.GetByIdAsync(incident.Id);

        Assert.NotNull(result);
        Assert.Equal(incident.Id, result.Id);
        Assert.Equal(incident.Title, result.Title);
        Assert.Equal(incident.FacilityId, result.FacilityId);
        Assert.Equal(IncidentStatus.Open, result.Status);
        Assert.Equal(incident.CreatedAtUtc, result.CreatedAtUtc);
    }

    [Fact]
    public async Task GetByIdAsync_WithUnknownIncident_ReturnsNull()
    {
        var test = new TestContext();

        var result = await test.Service.GetByIdAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateAsync_WithValidData_UpdatesIncident()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Titulo original");

        test.Incidents.Items.Add(incident);

        var originalId = incident.Id;
        var originalCreatedAt = incident.CreatedAtUtc;

        var updated = await test.Service.UpdateAsync(
            incident.Id,
            new UpdateIncidentCommand(
                "Titulo actualizado",
                "Nueva descripcion",
                IncidentPriority.Critical));

        Assert.True(updated);
        Assert.Equal(originalId, incident.Id);
        Assert.Equal("Titulo actualizado", incident.Title);
        Assert.Equal("Nueva descripcion", incident.Description);
        Assert.Equal(IncidentPriority.Critical, incident.Priority);
        Assert.Equal(originalCreatedAt, incident.CreatedAtUtc);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WithUnknownIncident_ReturnsFalse()
    {
        var test = new TestContext();

        var result = await test.Service.UpdateAsync(
            Guid.NewGuid(),
            new UpdateIncidentCommand(
                "Titulo", null, IncidentPriority.Low));

        Assert.False(result);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WithInvalidTitle_DoesNotSave()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Titulo original");

        test.Incidents.Items.Add(incident);

        await Assert.ThrowsAsync<ArgumentException>(
            () => test.Service.UpdateAsync(
                incident.Id,
                new UpdateIncidentCommand(
                    "   ",
                    "Descripcion",
                    IncidentPriority.High)));

        Assert.Equal("Titulo original", incident.Title);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenClosed_RejectsModification()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Incidencia cerrada");

        incident.StartProgress();
        incident.Resolve();
        incident.Close();

        test.Incidents.Items.Add(incident);

        var originalUpdatedAt = incident.UpdatedAtUtc;

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => test.Service.UpdateAsync(
                incident.Id,
                new UpdateIncidentCommand(
                    "Titulo nuevo",
                    null,
                    IncidentPriority.Low)));

        Assert.Equal(IncidentStatus.Closed, incident.Status);
        Assert.Equal("Incidencia cerrada", incident.Title);
        Assert.Equal(originalUpdatedAt, incident.UpdatedAtUtc);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task StartProgressAsync_WithOpenIncident_SavesState()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Nueva incidencia");

        test.Incidents.Items.Add(incident);

        var result = await test.Service.StartProgressAsync(
            incident.Id);

        Assert.True(result);
        Assert.Equal(IncidentStatus.InProgress, incident.Status);
        Assert.Null(incident.ResolvedAtUtc);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task ResolveAsync_WithInProgressIncident_SavesState()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Incidencia en curso");

        incident.StartProgress();

        test.Incidents.Items.Add(incident);

        var result = await test.Service.ResolveAsync(incident.Id);

        Assert.True(result);
        Assert.Equal(IncidentStatus.Resolved, incident.Status);
        Assert.NotNull(incident.ResolvedAtUtc);
        Assert.Equal(incident.UpdatedAtUtc, incident.ResolvedAtUtc);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CloseAsync_WithResolvedIncident_SavesState()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Incidencia resuelta");

        incident.StartProgress();
        incident.Resolve();

        test.Incidents.Items.Add(incident);

        var result = await test.Service.CloseAsync(incident.Id);

        Assert.True(result);
        Assert.Equal(IncidentStatus.Closed, incident.Status);
        Assert.NotNull(incident.ClosedAtUtc);
        Assert.Equal(incident.UpdatedAtUtc, incident.ClosedAtUtc);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task ReopenAsync_WithResolvedIncident_ClearsDates()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Incidencia resuelta");

        incident.StartProgress();
        incident.Resolve();

        test.Incidents.Items.Add(incident);

        var result = await test.Service.ReopenAsync(incident.Id);

        Assert.True(result);
        Assert.Equal(IncidentStatus.Open, incident.Status);
        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task ReopenAsync_WithClosedIncident_ClearsDates()
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Incidencia cerrada");

        incident.StartProgress();
        incident.Resolve();
        incident.Close();

        test.Incidents.Items.Add(incident);

        var result = await test.Service.ReopenAsync(incident.Id);

        Assert.True(result);
        Assert.Equal(IncidentStatus.Open, incident.Status);
        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Theory]
    [InlineData("start")]
    [InlineData("resolve")]
    [InlineData("close")]
    [InlineData("reopen")]
    public async Task ChangeStatusAsync_WithUnknownIncident_ReturnsFalse(
        string operation)
    {
        var test = new TestContext();

        var missingId = Guid.NewGuid();

        var result = operation switch
        {
            "start" => await test.Service.StartProgressAsync(missingId),
            "resolve" => await test.Service.ResolveAsync(missingId),
            "close" => await test.Service.CloseAsync(missingId),
            "reopen" => await test.Service.ReopenAsync(missingId),
            _ => throw new ArgumentOutOfRangeException(nameof(operation))
        };

        Assert.False(result);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Theory]
    [InlineData("start")]
    [InlineData("resolve")]
    [InlineData("close")]
    [InlineData("reopen")]
    public async Task ChangeStatusAsync_WithInvalidTransition_DoesNotSave(
        string operation)
    {
        var test = new TestContext();

        var incident = CreateIncidentForTest(
            Guid.NewGuid(), "Incidencia de prueba");

        if (operation == "start")
        {
            incident.StartProgress();
        }

        test.Incidents.Items.Add(incident);

        var originalStatus = incident.Status;
        var originalUpdatedAt = incident.UpdatedAtUtc;

        await Assert.ThrowsAsync<InvalidOperationException>(
            async () =>
            {
                switch (operation)
                {
                    case "start":
                        await test.Service.StartProgressAsync(incident.Id);
                        break;

                    case "resolve":
                        await test.Service.ResolveAsync(incident.Id);
                        break;

                    case "close":
                        await test.Service.CloseAsync(incident.Id);
                        break;

                    case "reopen":
                        await test.Service.ReopenAsync(incident.Id);
                        break;
                }
            });

        Assert.Equal(originalStatus, incident.Status);
        Assert.Equal(originalUpdatedAt, incident.UpdatedAtUtc);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    private static Incident CreateIncidentForTest(
        Guid facilityId,
        string title,
        IncidentPriority priority = IncidentPriority.Medium,
        Guid? assetId = null)
    {
        return new Incident(
            facilityId,
            title,
            "Descripcion de prueba",
            priority,
            assetId);
    }
}
