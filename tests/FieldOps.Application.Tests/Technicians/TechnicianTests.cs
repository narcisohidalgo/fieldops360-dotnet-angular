using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Technicians;

public sealed class TechnicianTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesActiveTechnician()
    {
        var technician = new Technician(
            "  TEC-001  ",
            "  Ana Lopez  ",
            "  ana@example.com  ",
            "  600123456  ",
            "  Electricidad  ");

        Assert.NotEqual(Guid.Empty, technician.Id);
        Assert.Equal("TEC-001", technician.Code);
        Assert.Equal("Ana Lopez", technician.Name);
        Assert.Equal("ana@example.com", technician.Email);
        Assert.Equal("600123456", technician.Phone);
        Assert.Equal("Electricidad", technician.Specialty);
        Assert.True(technician.IsActive);
    }

    [Fact]
    public void Constructor_WithBlankOptionalFields_StoresNull()
    {
        var technician = new Technician(
            "TEC-001", "Ana Lopez", "ana@example.com", " ", " ");

        Assert.Null(technician.Phone);
        Assert.Null(technician.Specialty);
    }

    [Fact]
    public void Constructor_WithoutOptionalFields_StoresNull()
    {
        var technician = new Technician(
            "TEC-001", "Ana Lopez", "ana@example.com");

        Assert.Null(technician.Phone);
        Assert.Null(technician.Specialty);
    }

    [Theory]
    [InlineData("", "Ana Lopez", "ana@example.com", "code")]
    [InlineData("TEC-001", " ", "ana@example.com", "name")]
    [InlineData("TEC-001", "Ana Lopez", " ", "email")]
    public void Constructor_WithBlankRequiredField_Throws(
        string code, string name, string email, string parameter)
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Technician(code, name, email));

        Assert.Equal(parameter, exception.ParamName);
    }

    [Theory]
    [InlineData("invalid-email")]
    [InlineData("ana@@example.com")]
    [InlineData("Ana <ana@example.com>")]
    public void Constructor_WithInvalidEmail_Throws(string email)
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Technician("TEC-001", "Ana Lopez", email));

        Assert.Equal("email", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithCodeTooLong_Throws()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Technician(
                new string('X', 31), "Ana Lopez", "ana@example.com"));

        Assert.Equal("code", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithNameTooLong_Throws()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Technician(
                "TEC-001", new string('X', 151), "ana@example.com"));

        Assert.Equal("name", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithEmailTooLong_Throws()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Technician(
                "TEC-001",
                "Ana Lopez",
                new string('x', 245) + "@example.com"));

        Assert.Equal("email", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithPhoneTooLong_Throws()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Technician(
                "TEC-001", "Ana Lopez", "ana@example.com",
                new string('1', 31)));

        Assert.Equal("phone", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithSpecialtyTooLong_Throws()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Technician(
                "TEC-001", "Ana Lopez", "ana@example.com",
                null, new string('X', 101)));

        Assert.Equal("specialty", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithMaximumAllowedLengths_Succeeds()
    {
        var technician = new Technician(
            new string('C', 30),
            new string('N', 150),
            "ana@example.com",
            new string('1', 30),
            new string('S', 100));

        Assert.Equal(30, technician.Code.Length);
        Assert.Equal(150, technician.Name.Length);
        Assert.Equal(30, technician.Phone!.Length);
        Assert.Equal(100, technician.Specialty!.Length);
    }

    [Fact]
    public void UpdateDetails_WithValidData_UpdatesFields()
    {
        var technician = CreateTechnician();
        var originalId = technician.Id;
        var originalCode = technician.Code;

        technician.UpdateDetails(
            "  Luis Garcia  ",
            "  luis@example.com  ",
            "  699123456  ",
            "  Mecanica  ");

        Assert.Equal("Luis Garcia", technician.Name);
        Assert.Equal("luis@example.com", technician.Email);
        Assert.Equal("699123456", technician.Phone);
        Assert.Equal("Mecanica", technician.Specialty);
        Assert.Equal(originalId, technician.Id);
        Assert.Equal(originalCode, technician.Code);
        Assert.True(technician.IsActive);
    }

    [Fact]
    public void UpdateDetails_WithBlankOptionalFields_StoresNull()
    {
        var technician = CreateTechnician();

        technician.UpdateDetails(
            "Ana Lopez", "ana@example.com", " ", " ");

        Assert.Null(technician.Phone);
        Assert.Null(technician.Specialty);
    }

    [Theory]
    [InlineData("name")]
    [InlineData("email")]
    [InlineData("phone")]
    [InlineData("specialty")]
    public void UpdateDetails_WithInvalidData_PreservesState(
        string invalidField)
    {
        var technician = CreateTechnician();

        var before = (
            technician.Id,
            technician.Code,
            technician.Name,
            technician.Email,
            technician.Phone,
            technician.Specialty,
            technician.IsActive);

        var name = invalidField == "name" ? " " : "Luis Garcia";
        var email = invalidField == "email"
            ? "invalid-email" : "luis@example.com";
        var phone = invalidField == "phone"
            ? new string('1', 31) : "699123456";
        var specialty = invalidField == "specialty"
            ? new string('X', 101) : "Mecanica";

        var exception = Assert.Throws<ArgumentException>(
            () => technician.UpdateDetails(
                name, email, phone, specialty));

        Assert.Equal(invalidField, exception.ParamName);

        var after = (
            technician.Id,
            technician.Code,
            technician.Name,
            technician.Email,
            technician.Phone,
            technician.Specialty,
            technician.IsActive);

        Assert.Equal(before, after);
    }

    [Fact]
    public void Deactivate_WithActiveTechnician_SetsInactive()
    {
        var technician = CreateTechnician();
        var originalId = technician.Id;

        technician.Deactivate();

        Assert.False(technician.IsActive);
        Assert.Equal(originalId, technician.Id);
        Assert.Equal("TEC-001", technician.Code);
    }

    [Fact]
    public void Activate_WithInactiveTechnician_SetsActive()
    {
        var technician = CreateTechnician();

        technician.Deactivate();
        technician.Activate();

        Assert.True(technician.IsActive);
    }

    [Fact]
    public void ActivateAndDeactivate_AreIdempotent()
    {
        var technician = CreateTechnician();

        technician.Deactivate();
        technician.Deactivate();
        Assert.False(technician.IsActive);

        technician.Activate();
        technician.Activate();
        Assert.True(technician.IsActive);
    }

    private static Technician CreateTechnician()
    {
        return new Technician(
            "TEC-001",
            "Ana Lopez",
            "ana@example.com",
            "600123456",
            "Electricidad");
    }
}
