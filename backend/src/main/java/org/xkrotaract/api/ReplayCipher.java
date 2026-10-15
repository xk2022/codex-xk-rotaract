package org.xkrotaract.api;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Authenticated encryption for retained API responses; never accepts plaintext. */
@Component
class ReplayCipher {
  private final SecretKeySpec key;
  private final SecureRandom random = new SecureRandom();

  ReplayCipher(@Value("${app.idempotency-secret}") String secret) {
    if (secret.length() < 32)
      throw new IllegalArgumentException("IDEMPOTENCY_SECRET needs at least 32 characters");
    try {
      // Purpose separation: a fixed, non-request context derives an independent 256-bit AES key.
      Mac derive = Mac.getInstance("HmacSHA256");
      derive.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      key =
          new SecretKeySpec(
              derive.doFinal(
                  "xk-rotaract/idempotency-response/aes-gcm/v1".getBytes(StandardCharsets.UTF_8)),
              "AES");
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  String encrypt(String plaintext, String associatedData) {
    try {
      byte[] nonce = new byte[12];
      random.nextBytes(nonce);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, nonce));
      cipher.updateAAD(associatedData.getBytes(StandardCharsets.UTF_8));
      byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      byte[] envelope = Arrays.copyOf(nonce, nonce.length + encrypted.length);
      System.arraycopy(encrypted, 0, envelope, nonce.length, encrypted.length);
      return "v1." + Base64.getEncoder().encodeToString(envelope);
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("Cannot protect replay response", e);
    }
  }

  String decrypt(String envelope, String associatedData) {
    try {
      if (!envelope.startsWith("v1."))
        throw new GeneralSecurityException("Unsupported replay envelope");
      byte[] bytes = Base64.getDecoder().decode(envelope.substring(3));
      if (bytes.length < 28) throw new GeneralSecurityException("Invalid replay envelope");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Arrays.copyOf(bytes, 12)));
      cipher.updateAAD(associatedData.getBytes(StandardCharsets.UTF_8));
      return new String(cipher.doFinal(bytes, 12, bytes.length - 12), StandardCharsets.UTF_8);
    } catch (GeneralSecurityException | IllegalArgumentException e) {
      throw new IllegalStateException("Replay response authentication failed", e);
    }
  }
}
