using Microsoft.AspNetCore.Mvc;

namespace VehicleTracker.Web.Controllers;

public class AdminController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
    
    public IActionResult Vehicles()
    {
        return View();
    }
    
    public IActionResult Drivers()
    {
        return View();
    }
    
    public IActionResult Incidents()
    {
        return View();
    }
    
    public IActionResult Users()
    {
        return View();
    }
}
