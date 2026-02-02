using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace VehicleTracker.Api.Models;

[Table("incident_priority")]
public class IncidentPriority
{
    [Key]
    [Column("incident_priority_id")]
    public int IncidentPriorityId { get; set; }

    [Required]
    [Column("priority_name")]
    [MaxLength(20)]
    public string PriorityName { get; set; } = string.Empty;

    // Navigation property
    [JsonIgnore]
    public ICollection<Incident> Incidents { get; set; } = new List<Incident>();
}
