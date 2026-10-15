package org.xkrotaract.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class TaskController {
  final TaskService service;
  final ApiSupport access;
  TaskController(TaskService service,ApiSupport access){this.service=service;this.access=access;}
  @GetMapping("/me/tasks")
  Object tasks(@RequestParam Map<String,String> query,HttpServletRequest request){return service.tasks(access.actor(request),query);}
}
