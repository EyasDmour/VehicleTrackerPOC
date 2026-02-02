using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracker.Api.Data;
using VehicleTracker.Api.Models;

namespace VehicleTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentPrioritiesController : ControllerBase
{
    private readonly AppDbContext _context;

    public IncidentPrioritiesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var priorities = await _context.IncidentPriorities.ToListAsync();
        return Ok(priorities);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var priority = await _context.IncidentPriorities.FindAsync(id);
        if (priority == null) return NotFound();
        return Ok(priority);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] IncidentPriority priority)
    {
        _context.IncidentPriorities.Add(priority);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = priority.IncidentPriorityId }, priority);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] IncidentPriority priority)
    {
        if (id != priority.IncidentPriorityId) return BadRequest();
        _context.Entry(priority).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var priority = await _context.IncidentPriorities.FindAsync(id);
        if (priority == null) return NotFound();
        _context.IncidentPriorities.Remove(priority);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
