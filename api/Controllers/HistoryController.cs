using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracker.Api.Data;

namespace VehicleTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HistoryController : ControllerBase
{
    private readonly AppDbContext _context;

    public HistoryController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Get today's trail for a vehicle (used when opening history UI)
    /// </summary>
    [HttpGet("vehicles/{vehicleId}/today")]
    public async Task<IActionResult> GetTodayTrail(int vehicleId)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var trail = await _context.LocationHistory
            .Where(l => l.VehicleId == vehicleId && l.Timestamp >= today && l.Timestamp < tomorrow)
            .OrderBy(l => l.Timestamp)
            .ThenBy(l => l.Id)
            .Select(l => new
            {
                l.Timestamp,
                Latitude = l.Location != null ? l.Location.Y : (double?)null,
                Longitude = l.Location != null ? l.Location.X : (double?)null,
                l.Speed,
                l.Fuel
            })
            .ToListAsync();

        return Ok(new
        {
            vehicleId,
            date = today,
            pointCount = trail.Count,
            trail
        });
    }

    /// <summary>
    /// Get trail for a vehicle within a date/time range
    /// </summary>
    [HttpGet("vehicles/{vehicleId}/range")]
    public async Task<IActionResult> GetRangeTrail(
        int vehicleId,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to)
    {
        if (from >= to)
            return BadRequest(new { message = "'from' must be before 'to'" });

        var trail = await _context.LocationHistory
            .Where(l => l.VehicleId == vehicleId && l.Timestamp >= from && l.Timestamp <= to)
            .OrderBy(l => l.Timestamp)
            .ThenBy(l => l.Id)
            .Select(l => new
            {
                l.Timestamp,
                Latitude = l.Location != null ? l.Location.Y : (double?)null,
                Longitude = l.Location != null ? l.Location.X : (double?)null,
                l.Speed,
                l.Fuel
            })
            .ToListAsync();

        return Ok(new
        {
            vehicleId,
            from,
            to,
            pointCount = trail.Count,
            trail
        });
    }
}
