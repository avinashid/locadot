import http from "http";
import httpProxy from "http-proxy";

import { proxyNotFound } from "../constants/template";
import type { DomainRegistry } from "./locadot-file";
import logger from "../utils/logger";
export default class HttpModule {
  static requestHandler(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    proxy: httpProxy<
      http.IncomingMessage,
      http.ServerResponse<http.IncomingMessage>
    >,
    domainMap: DomainRegistry
  ) {
    try {
      const host = req.headers.host?.split(":")[0];
      const targetPort = domainMap[host!];

      if (!targetPort) {
        res.writeHead(502, { "Content-Type": "text/html" });
        res.end(proxyNotFound(host!));
      }
      proxy.web(
        req,
        res,
        {
          target: `http://localhost:${targetPort}`,
          changeOrigin: true,
          headers: {
            "X-Original-Host": host || "localhost",
          },
        },
        (err) => {
          logger.warn(host || "", "warn", `${err.name}=> ${err.message}`);
          res.writeHead(502);
          res.end("Connection failed. Host not found.");
        }
      );
    } catch (error) {
      logger.error(error);
    }
  }
  static requestUpgrade = (
    req: http.IncomingMessage,
    socket: any,
    head: any,
    proxy: httpProxy<
      http.IncomingMessage,
      http.ServerResponse<http.IncomingMessage>
    >,
    domainMap: DomainRegistry
  ) => {
    try {
      const host = req.headers.host?.split(":")[0];
      const targetPort = domainMap[host!];

      if (!targetPort) {
        socket.end();
        return;
      }

      logger.info(host || "", "log", `WebSocket upgrade request for ${host}`);

      proxy.ws(
        req,
        socket,
        head,
        {
          target: `ws://localhost:${targetPort}`,
          ws: true,
          changeOrigin: true,
          headers: {
            host: `localhost:${targetPort}`,
            "X-Original-Host": host || "localhost",
          },
        },
        (err) => {
          // locadotFile.updateLogs(
          //   host || "",
          //   "warn",
          //   `WebSocket Error: ${err.name}=> ${err.message}`
          // );
          socket.end();
        }
      );
    } catch (error) {
      logger.error(error);
    }
  };
}
