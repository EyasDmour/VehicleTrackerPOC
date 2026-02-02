using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracker.Api.Data;
using VehicleTracker.Api.Models;

namespace VehicleTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentStatusesController : ControllerBase
{
    private readonly AppDbContext _context;

    public IncidentStatusesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var statuses = await _context.IncidentStatuses.ToListAsync();
        return Ok(statuses);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var status = await _context.IncidentStatuses.FindAsync(id);
        if (status == null) return NotFound();
        return Ok(status);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] IncidentStatus status)
    {
        _context.IncidentStatuses.Add(status);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = status.IncidentStatusId }, status);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] IncidentStatus status)
    {
        if (id != status.IncidentStatusId) return BadRequest();
        _context.Entry(status).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var status = await _context.IncidentStatuses.FindAsync(id);
        if (status == null) return NotFound();
        _context.IncidentStatuses.Remove(status);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
