using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Facilities;

public sealed class FacilityCoordinatesTests
{
    private static Facility CreateFacility() =>
        new("FAC-GIS-001", "Centro GIS", "Cordoba");

    [Fact]
    public void NewFacility_HasNoCoordinates()
    {
        var facility = CreateFacility();

        Assert.Null(facility.Latitude);
        Assert.Null(facility.Longitude);
    }

    [Fact]
    public void SetCoordinates_WithValidValues_SavesBoth()
    {
        var facility = CreateFacility();

        facility.SetCoordinates(37.8882m, -4.7794m);

        Assert.Equal(37.8882m, facility.Latitude);
        Assert.Equal(-4.7794m, facility.Longitude);
    }

    [Fact]
    public void SetCoordinates_WithNullValues_ClearsBoth()
    {
        var facility = CreateFacility();

        facility.SetCoordinates(37.8882m, -4.7794m);
        facility.SetCoordinates(null, null);

        Assert.Null(facility.Latitude);
        Assert.Null(facility.Longitude);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void SetCoordinates_WithOnlyOneValue_Rejects(
        bool latitudeOnly)
    {
        var facility = CreateFacility();

        Assert.Throws<ArgumentException>(() =>
            facility.SetCoordinates(
                latitudeOnly ? 37m : null,
                latitudeOnly ? null : -4m));

        Assert.Null(facility.Latitude);
        Assert.Null(facility.Longitude);
    }

    [Theory]
    [InlineData(-91, 0)]
    [InlineData(91, 0)]
    [InlineData(0, -181)]
    [InlineData(0, 181)]
    public void SetCoordinates_OutOfRange_Rejects(
        int latitude,
        int longitude)
    {
        var facility = CreateFacility();

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            facility.SetCoordinates(latitude, longitude));
    }

    [Fact]
    public void SetCoordinates_InvalidUpdate_PreservesPreviousValues()
    {
        var facility = CreateFacility();
        facility.SetCoordinates(37.8882m, -4.7794m);

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            facility.SetCoordinates(95m, 20m));

        Assert.Equal(37.8882m, facility.Latitude);
        Assert.Equal(-4.7794m, facility.Longitude);
    }

    [Fact]
    public void SetCoordinates_BoundaryValues_AreValid()
    {
        var facility = CreateFacility();

        facility.SetCoordinates(-90m, 180m);

        Assert.Equal(-90m, facility.Latitude);
        Assert.Equal(180m, facility.Longitude);

        facility.SetCoordinates(90m, -180m);

        Assert.Equal(90m, facility.Latitude);
        Assert.Equal(-180m, facility.Longitude);
    }
}