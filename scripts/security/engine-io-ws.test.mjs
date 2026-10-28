// Run with: node --test scripts/security/engine-io-ws.test.mjs
// The server is a bounded Engine.IO v4 protocol fixture. The client and both
// WebSocket endpoints use the actual Trigger dependency tree, without mocks.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("@trigger.dev/sdk"));
const coreRequire = createRequire(sdkRequire.resolve("@trigger.dev/core"));
const socketIoRequire = createRequire(coreRequire.resolve("socket.io-client"));
const engineRequire = createRequire(
  socketIoRequire.resolve("engine.io-client"),
);
const { Socket } = socketIoRequire("engine.io-client");
const { WebSocketServer } = engineRequire("ws");
const wsVersion = engineRequire("ws/package.json").version;

function nextEvent(emitter, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5000);
    function cleanup() {
      clearTimeout(timer);
      emitter.off(event, onEvent);
      emitter.off("error", onError);
    }
    function onEvent(...args) {
      cleanup();
      resolve(args);
    }
    function onError(error) {
      cleanup();
      reject(error);
    }
    emitter.once(event, onEvent);
    emitter.once("error", onError);
  });
}

await test("Trigger's Engine.IO client resolves a patched ws 8 version", (context) => {
  context.diagnostic(`Actual Engine.IO WebSocket dependency: ws ${wsVersion}`);
  const version = /^8\.(\d+)\.\d+$/.exec(wsVersion);
  assert.ok(
    version && Number(version[1]) >= 21,
    `Expected ws >=8.21.0 within major 8; Engine.IO resolved ${wsVersion}`,
  );
});

await test(
  "Trigger's real Engine.IO client exchanges text, binary, heartbeats and a clean close over loopback",
  { timeout: 15_000 },
  async (context) => {
    const server = new WebSocketServer({
      host: "127.0.0.1",
      port: 0,
      perMessageDeflate: false,
      maxPayload: 1024,
    });
    context.after(async () => {
      for (const socket of server.clients) socket.terminate();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    });
    await nextEvent(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const connected = nextEvent(server, "connection");
    const client = new Socket(`http://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      upgrade: false,
      path: "/engine.io/",
    });
    context.after(() => client.close());
    client.binaryType = "arraybuffer";
    const opened = nextEvent(client, "open");
    const [socket, request] = await connected;
    const url = new URL(request.url, `http://127.0.0.1:${address.port}`);
    assert.equal(url.pathname, "/engine.io/");
    assert.equal(url.searchParams.get("EIO"), "4");
    assert.equal(url.searchParams.get("transport"), "websocket");
    socket.send(
      `0${JSON.stringify({
        sid: "synthetic-local-session",
        upgrades: [],
        pingInterval: 60_000,
        pingTimeout: 10_000,
        maxPayload: 1024,
      })}`,
    );
    await opened;
    assert.equal(client.id, "synthetic-local-session");
    assert.equal(client.transport.name, "websocket");
    assert.equal(client.readyState, "open");

    const receivedText = nextEvent(socket, "message");
    client.send("client text: ಕನ್ನಡ");
    const [text, textIsBinary] = await receivedText;
    assert.equal(textIsBinary, false);
    assert.equal(text.toString(), "4client text: ಕನ್ನಡ");
    const returnedText = nextEvent(client, "message");
    socket.send("4server text: مرحبا");
    assert.deepEqual(await returnedText, ["server text: مرحبا"]);

    const sentBytes = Buffer.from([0, 1, 127, 128, 254, 255]);
    const receivedBinary = nextEvent(socket, "message");
    client.send(new Uint8Array(sentBytes));
    const [binary, isBinary] = await receivedBinary;
    assert.equal(isBinary, true);
    assert.deepEqual(Buffer.from(binary), sentBytes);
    const returnedBytes = Buffer.from([255, 128, 1, 0, 254]);
    const returnedBinary = nextEvent(client, "message");
    socket.send(returnedBytes, { binary: true });
    const [clientBinary] = await returnedBinary;
    assert.ok(clientBinary instanceof ArrayBuffer);
    assert.deepEqual(Buffer.from(clientBinary), returnedBytes);

    // Engine.IO heartbeat packets are distinct from WebSocket control frames.
    const enginePong = nextEvent(socket, "message");
    const clientPing = nextEvent(client, "ping");
    socket.send("2");
    const [[pong, pongIsBinary]] = await Promise.all([enginePong, clientPing]);
    assert.equal(pongIsBinary, false);
    assert.equal(pong.toString(), "3");
    assert.equal(client.readyState, "open");

    const wirePong = nextEvent(socket, "pong");
    const heartbeat = Buffer.from("local-ws-heartbeat");
    socket.ping(heartbeat);
    const [pongBytes] = await wirePong;
    assert.deepEqual(pongBytes, heartbeat);

    const clientClosed = nextEvent(client, "close");
    const serverClosed = nextEvent(socket, "close");
    socket.close(1000, "fixture complete");
    const [[reason], [closeCode, closeReason]] = await Promise.all([
      clientClosed,
      serverClosed,
    ]);
    assert.equal(reason, "transport close");
    assert.equal(client.readyState, "closed");
    assert.equal(closeCode, 1000);
    assert.equal(closeReason.toString(), "fixture complete");
  },
);
