using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracker.Api.Data;
using VehicleTracker.Api.Models;

namespace VehicleTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehicleStatusesController : ControllerBase
{
    private readonly AppDbContext _context;

    public VehicleStatusesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var statuses = await _context.VehicleStatuses.ToListAsync();
        return Ok(statuses);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var status = await _context.VehicleStatuses.FindAsync(id);
        if (status == null) return NotFound();
        return Ok(status);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] VehicleStatus status)
    {
        if (status.VehicleStatusId == Guid.Empty)
            status.VehicleStatusId = Guid.NewGuid();
        _context.VehicleStatuses.Add(status);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = status.VehicleStatusId }, status);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] VehicleStatus status)
    {
        if (id != status.VehicleStatusId) return BadRequest();
        _context.Entry(status).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var status = await _context.VehicleStatuses.FindAsync(id);
        if (status == null) return NotFound();
        _context.VehicleStatuses.Remove(status);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
