package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

@Timeout(15)
class PostgresqlSecurityRegressionTest {
  @Test
  void defaultLimitRejectsExcessiveScramIterationsBeforeClientProof() throws Exception {
    // CVE-2026-42198：只超過預設上限一輪，讓舊版負向驗證也不會耗用無界CPU。
    var outcome = authenticateAgainstSyntheticServer(100001, null);

    assertEquals("08004", outcome.failure().getSQLState());
    assertTrue(outcome.failure().getMessage().contains("scramMaxIterations"));
    assertTrue(outcome.failure().getMessage().contains("client-side limit"));
    assertFalse(outcome.clientProofSent(), "Excessive challenge must stop before client proof");
  }

  @Test
  void explicitIterationLimitRejectsChallengeBeforeClientProof() throws Exception {
    var outcome = authenticateAgainstSyntheticServer(4097, "4096");

    assertEquals("08004", outcome.failure().getSQLState());
    assertTrue(outcome.failure().getMessage().contains("scramMaxIterations"));
    assertTrue(outcome.failure().getMessage().contains("client-side limit"));
    assertFalse(outcome.clientProofSent(), "Configured iteration limit must be enforced");
  }

  @Test
  void ordinaryScramChallengeStillProducesClientProof() throws Exception {
    var outcome = authenticateAgainstSyntheticServer(4096, null);

    assertEquals("28P01", outcome.failure().getSQLState());
    assertTrue(outcome.clientProofSent(), "A normal challenge must still reach SCRAM proof");
  }

  private static Outcome authenticateAgainstSyntheticServer(int iterations, String limit)
      throws Exception {
    try (var server = new SyntheticScramServer(iterations)) {
      var properties = new Properties();
      properties.setProperty("user", "synthetic_security_test");
      properties.setProperty("password", "synthetic-only-password");
      if (limit != null) properties.setProperty("scramMaxIterations", limit);

      SQLException failure =
          assertThrows(
              SQLException.class,
              () -> {
                try (Connection ignored = DriverManager.getConnection(server.url(), properties)) {
                  fail("Synthetic peer must never authenticate a database connection");
                }
              });
      return new Outcome(failure, server.clientProofSent());
    }
  }

  private record Outcome(SQLException failure, boolean clientProofSent) {}

  private record Frame(int type, byte[] body) {}

  private static final class SyntheticScramServer implements AutoCloseable {
    private static final int MAX_FRAME_BYTES = 4096;
    private final ServerSocket listener;
    private final ExecutorService worker;
    private final Future<Boolean> result;
    private volatile Socket accepted;

    SyntheticScramServer(int iterations) throws IOException {
      listener = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
      listener.setSoTimeout(4000);
      worker =
          Executors.newSingleThreadExecutor(
              runnable -> {
                var thread = new Thread(runnable, "synthetic-postgresql-scram");
                thread.setDaemon(true);
                return thread;
              });
      result = worker.submit(() -> exchange(iterations));
    }

    String url() {
      // 只對本測試的loopback協定模擬器停用SSL/GSS；不讀取或改動應用資料來源設定。
      return "jdbc:postgresql://127.0.0.1:"
          + listener.getLocalPort()
          + "/synthetic_security_test?sslmode=disable&gssEncMode=disable"
          + "&socketTimeout=4&loginTimeout=5";
    }

    boolean clientProofSent() throws Exception {
      return result.get(5, TimeUnit.SECONDS);
    }

    private boolean exchange(int iterations) throws IOException {
      try (Socket peer = listener.accept()) {
        accepted = peer;
        peer.setSoTimeout(4000);
        var input = new DataInputStream(peer.getInputStream());
        var output = new DataOutputStream(peer.getOutputStream());
        int startupLength = input.readInt();
        if (startupLength < 8 || startupLength > MAX_FRAME_BYTES)
          throw new IOException("Invalid synthetic startup frame length");
        if (input.readInt() != 196608)
          throw new IOException("Expected PostgreSQL protocol version 3");
        input.readFully(new byte[startupLength - 8]);

        authentication(output, 10, "SCRAM-SHA-256\0\0");
        Frame initial = readFrame(input);
        if (initial == null || initial.type() != 'p')
          throw new IOException("Missing synthetic SASL initial response");
        String nonce = clientNonce(initial.body());
        authentication(
            output,
            11,
            "r=" + nonce + "-synthetic-server,s=c3ludGhldGljLXNhbHQ=,i=" + iterations);

        Frame proof;
        try {
          proof = readFrame(input);
        } catch (EOFException | SocketException closedAfterRejection) {
          return false;
        }
        if (proof == null || proof.type() == 'X') return false;
        if (proof.type() != 'p') throw new IOException("Unexpected synthetic SASL response type");
        String finalMessage = new String(proof.body(), StandardCharsets.UTF_8);
        if (!finalMessage.startsWith("c=") || !finalMessage.contains(",p="))
          throw new IOException("Missing synthetic SCRAM client proof fields");

        // 只保留有無送出proof的布林結果，不記錄或輸出合成密碼與proof內容。
        byte[] error =
            "SERROR\0C28P01\0MSynthetic credentials are not accepted\0\0"
                .getBytes(StandardCharsets.UTF_8);
        output.writeByte('E');
        output.writeInt(4 + error.length);
        output.write(error);
        output.flush();
        return true;
      }
    }

    private static String clientNonce(byte[] body) throws IOException {
      var input = new DataInputStream(new ByteArrayInputStream(body));
      var mechanism = new ByteArrayOutputStream();
      int next;
      while ((next = input.read()) != 0) {
        if (next < 0) throw new IOException("Missing synthetic SASL mechanism terminator");
        mechanism.write(next);
      }
      if (!mechanism.toString(StandardCharsets.UTF_8).equals("SCRAM-SHA-256"))
        throw new IOException("Unexpected synthetic SASL mechanism");
      int length = input.readInt();
      if (length < 0 || length != input.available())
        throw new IOException("Invalid synthetic SASL initial response length");
      String firstMessage = new String(input.readNBytes(length), StandardCharsets.UTF_8);
      for (String field : firstMessage.split(","))
        if (field.startsWith("r=") && field.length() > 2) return field.substring(2);
      throw new IOException("Missing synthetic SCRAM client nonce");
    }

    private static Frame readFrame(DataInputStream input) throws IOException {
      int type = input.read();
      if (type < 0) return null;
      int length = input.readInt();
      if (length < 4 || length > MAX_FRAME_BYTES)
        throw new IOException("Invalid synthetic authentication frame length");
      byte[] body = new byte[length - 4];
      input.readFully(body);
      return new Frame(type, body);
    }

    private static void authentication(DataOutputStream output, int kind, String message)
        throws IOException {
      byte[] body = message.getBytes(StandardCharsets.UTF_8);
      output.writeByte('R');
      output.writeInt(8 + body.length);
      output.writeInt(kind);
      output.write(body);
      output.flush();
    }

    @Override
    public void close() throws Exception {
      try {
        listener.close();
        Socket peer = accepted;
        if (peer != null) peer.close();
      } finally {
        worker.shutdownNow();
        if (!worker.awaitTermination(5, TimeUnit.SECONDS))
          throw new IllegalStateException("Synthetic SCRAM peer did not terminate");
      }
    }
  }
}
