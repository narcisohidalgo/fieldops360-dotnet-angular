using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Tests.Incidents;

public sealed class IncidentTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesOpenIncident()
    {
        var facilityId = Guid.NewGuid();
        var assetId = Guid.NewGuid();

        var before = DateTimeOffset.UtcNow;

        var incident = new Incident(
            facilityId,
            "  Fallo en tractor  ",
            "  El motor no arranca  ",
            IncidentPriority.High,
            assetId);

        var after = DateTimeOffset.UtcNow;

        Assert.NotEqual(Guid.Empty, incident.Id);
        Assert.Equal(facilityId, incident.FacilityId);
        Assert.Equal(assetId, incident.AssetId);

        Assert.Equal("Fallo en tractor", incident.Title);
        Assert.Equal("El motor no arranca", incident.Description);

        Assert.Equal(IncidentPriority.High, incident.Priority);
        Assert.Equal(IncidentStatus.Open, incident.Status);

        Assert.InRange(incident.CreatedAtUtc, before, after);
        Assert.Equal(incident.CreatedAtUtc, incident.UpdatedAtUtc);

        Assert.Null(incident.ResolvedAtUtc);
        Assert.Null(incident.ClosedAtUtc);
    }

    [Fact]
    public void Constructor_WithoutAsset_AllowsNullAsset()
    {
        var incident = new Incident(
            Guid.NewGuid(),
            "Problema electrico",
            "   ",
            IncidentPriority.Medium);

        Assert.Null(incident.AssetId);
        Assert.Null(incident.Description);
        Assert.Equal(IncidentStatus.Open, incident.Status);
    }

    [Fact]
    public void Constructor_WithEmptyFacilityId_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Incident(
                Guid.Empty,
                "Fallo electrico",
                null,
                IncidentPriority.High));

        Assert.Equal("facilityId", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithEmptyAssetId_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Incident(
                Guid.NewGuid(),
                "Fallo electrico",
                null,
                IncidentPriority.High,
                Guid.Empty));

        Assert.Equal("assetId", exception.ParamName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_WithBlankTitle_ThrowsArgumentException(
        string title)
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Incident(
                Guid.NewGuid(),
                title,
                null,
                IncidentPriority.Low));

        Assert.Equal("title", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithTitleTooLong_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Incident(
                Guid.NewGuid(),
                new string('X', 151),
                null,
                IncidentPriority.High));

        Assert.Equal("title", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithDescriptionTooLong_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Incident(
                Guid.NewGuid(),
                "Fallo mecanico",
                new string('X', 2001),
                IncidentPriority.High));

        Assert.Equal("description", exception.ParamName);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    [InlineData(-1)]
    public void Constructor_WithInvalidPriority_ThrowsException(
        int priority)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => new Incident(
                Guid.NewGuid(),
                "Incidencia de prueba",
                null,
                (IncidentPriority)priority));
    }

    [Theory]
    [InlineData(IncidentPriority.Low)]
    [InlineData(IncidentPriority.Medium)]
    [InlineData(IncidentPriority.High)]
    [InlineData(IncidentPriority.Critical)]
    public void Constructor_WithValidPriority_Succeeds(
        IncidentPriority priority)
    {
        var incident = new Incident(
            Guid.NewGuid(),
            "Incidencia de prueba",
            null,
            priority);

        Assert.Equal(priority, incident.Priority);
    }

    [Fact]
    public void UpdateDetails_WithValidData_UpdatesFields()
    {
        var incident = CreateIncident();

        var originalId = incident.Id;
        var originalFacilityId = incident.FacilityId;
        var originalCreatedAt = incident.CreatedAtUtc;

        incident.UpdateDetails(
            "  Sensor averiado  ",
            "  Temperatura incorrecta  ",
            IncidentPriority.Critical);

        Assert.Equal("Sensor averiado", incident.Title);
        Assert.Equal(
            "Temperatura incorrecta",
            incident.Description);

        Assert.Equal(
            IncidentPriority.Critical,
            incident.Priority);

        Assert.Equal(IncidentStatus.Open, incident.Status);

        Assert.Equal(originalId, incident.Id);
        Assert.Equal(originalFacilityId, incident.FacilityId);
        Assert.Equal(originalCreatedAt, incident.CreatedAtUtc);

        Assert.True(incident.UpdatedAtUtc >= originalCreatedAt);
    }

    [Fact]
    public void UpdateDetails_WithBlankDescription_StoresNull()
    {
        var incident = CreateIncident();

        incident.UpdateDetails(
            "Incidencia actualizada",
            "   ",
            IncidentPriority.Medium);

        Assert.Null(incident.Description);
        Assert.Equal(
            "Incidencia actualizada",
            incident.Title);
    }

    [Fact]
    public void UpdateDetails_WithInvalidPriority_DoesNotModifyFields()
    {
        var incident = CreateIncident();

        var originalTitle = incident.Title;
        var originalDescription = incident.Description;
        var originalPriority = incident.Priority;
        var originalUpdatedAt = incident.UpdatedAtUtc;

        Assert.Throws<ArgumentOutOfRangeException>(
            () => incident.UpdateDetails(
                "Titulo nuevo",
                "Descripcion nueva",
                (IncidentPriority)99));

        Assert.Equal(originalTitle, incident.Title);
        Assert.Equal(originalDescription, incident.Description);
        Assert.Equal(originalPriority, incident.Priority);
        Assert.Equal(originalUpdatedAt, incident.UpdatedAtUtc);
    }

    [Fact]
    public void UpdateDetails_WithInvalidTitle_DoesNotModifyFields()
    {
        var incident = CreateIncident();

        var originalTitle = incident.Title;
        var originalPriority = incident.Priority;

        Assert.Throws<ArgumentException>(
            () => incident.UpdateDetails(
                "   ",
                "Nueva descripcion",
                IncidentPriority.Critical));

        Assert.Equal(originalTitle, incident.Title);
        Assert.Equal(originalPriority, incident.Priority);
    }

    private static Incident CreateIncident()
    {
        return new Incident(
            Guid.NewGuid(),
            "Fallo en sensor",
            "El sensor no responde",
            IncidentPriority.High);
    }
}
