package org.xkrotaract.api;

final class ApiException extends RuntimeException {
  final int status;
  final String code;

  ApiException(int status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static ApiException bad() {
    return new ApiException(400, "VALIDATION_ERROR", "請檢查輸入欄位與格式。");
  }

  static ApiException missing() {
    return new ApiException(404, "NOT_FOUND", "找不到資源。");
  }

  static ApiException conflict() {
    return new ApiException(409, "STATE_CONFLICT", "目前狀態無法執行此操作。");
  }

  static ApiException auth() {
    return new ApiException(401, "AUTHENTICATION_FAILED", "需要有效登入，或登入資料不正確。");
  }
}
