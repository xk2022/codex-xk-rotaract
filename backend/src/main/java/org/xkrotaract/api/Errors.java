package org.xkrotaract.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
class Errors {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<?> api(ApiException e, HttpServletRequest req) {
    return response(e.status, e.code, e.getMessage(), req);
  }

  @ExceptionHandler({
    org.springframework.http.converter.HttpMessageNotReadableException.class,
    org.springframework.web.bind.MissingServletRequestParameterException.class,
    org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
    java.time.format.DateTimeParseException.class,
    IllegalArgumentException.class
  })
  ResponseEntity<?> bad(Exception e, HttpServletRequest req) {
    return response(400, "VALIDATION_ERROR", "請檢查輸入欄位與格式。", req);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> conflict(Exception e, HttpServletRequest req) {
    return response(409, "STATE_CONFLICT", "資料已異動或識別值無法使用。", req);
  }

  @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
  ResponseEntity<?> missing(Exception e, HttpServletRequest req) {
    return response(404, "NOT_FOUND", "找不到資源。", req);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> failure(Exception e, HttpServletRequest req) {
    return response(503, "SERVICE_UNAVAILABLE", "服務暫時無法完成操作。", req);
  }

  private ResponseEntity<?> response(
      int status, String code, String message, HttpServletRequest req) {
    Object id = req.getAttribute("requestId");
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "code",
                code,
                "message",
                message,
                "fieldErrors",
                List.of(),
                "requestId",
                id == null ? UUID.randomUUID().toString() : id));
  }
}
