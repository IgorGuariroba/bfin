// light-my-request's MockSocket extends EventEmitter without Node's Socket
// methods. @hono/node-server (loaded transitively by @modelcontextprotocol/sdk's
// StreamableHTTPServerTransport) schedules a drain timer that calls
// socket.destroySoon() — which doesn't exist on MockSocket — and throws an
// uncaught TypeError that fails the whole run. Polyfill destroySoon as a noop
// so the timer is harmless in tests.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Request } = require("light-my-request/lib/request.js") as {
  Request: { prototype: { socket?: unknown } };
};

// MockSocket is defined inside request.js and not exported. Grab it from an
// instance by instantiating a minimal Request.
const probe = new (Request as unknown as new (opts: { url: string }) => { socket: object })({
  url: "/",
});
const MockSocketProto = Object.getPrototypeOf(probe.socket);
if (typeof (MockSocketProto as { destroySoon?: unknown }).destroySoon !== "function") {
  Object.defineProperty(MockSocketProto, "destroySoon", {
    value: function destroySoon() {
      // MockSocket has no real socket to drain; the hono drain timer fires
      // after tests tear down, so a noop is sufficient.
    },
    writable: true,
    configurable: true,
  });
}
if (!Object.prototype.hasOwnProperty.call(MockSocketProto, "destroyed")) {
  Object.defineProperty(MockSocketProto, "destroyed", {
    get() {
      return false;
    },
    configurable: true,
  });
}
