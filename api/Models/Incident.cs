using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace VehicleTracker.Api.Models;

[Table("incident")]
public class Incident
{
    [Key]
    [Column("incident_id")]
    public int IncidentId { get; set; }

    [Column("incident_status_id")]
    public int? IncidentStatusId { get; set; }

    [Column("assigned_to")]
    public int? AssignedTo { get; set; }

    [Column("title")]
    [MaxLength(200)]
    public string? Title { get; set; }

    [Column("description")]
    [MaxLength(1000)]
    public string? Description { get; set; }

    [Column("incident_priority_id")]
    public int? IncidentPriorityId { get; set; }

    [Column("location_name")]
    [MaxLength(200)]
    public string? LocationName { get; set; }

    [Column("location", TypeName = "geometry(Point,4326)")]
    [JsonIgnore]
    public Point? Location { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    // Helper properties for JSON serialization
    [NotMapped]
    public double? Latitude => Location?.Y;
    
    [NotMapped]
    public double? Longitude => Location?.X;

    // Navigation properties
    [ForeignKey("IncidentStatusId")]
    [JsonIgnore]
    public IncidentStatus? IncidentStatus { get; set; }

    [ForeignKey("IncidentPriorityId")]
    [JsonIgnore]
    public IncidentPriority? IncidentPriority { get; set; }

    [ForeignKey("AssignedTo")]
    [JsonIgnore]
    public Vehicle? AssignedVehicle { get; set; }
}
