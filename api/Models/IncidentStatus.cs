using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace VehicleTracker.Api.Models;

[Table("incident_status")]
public class IncidentStatus
{
    [Key]
    [Column("incident_status_id")]
    public int IncidentStatusId { get; set; }

    [Required]
    [Column("status_name")]
    [MaxLength(50)]
    public string StatusName { get; set; } = string.Empty;

    [Column("requires_vehicle")]
    public bool RequiresVehicle { get; set; } = false;

    // Navigation property
    [JsonIgnore]
    public ICollection<Incident> Incidents { get; set; } = new List<Incident>();
}
