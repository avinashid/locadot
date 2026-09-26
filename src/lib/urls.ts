import Constants from "../constants";

/** http(s)://host with the port only when it isn't the scheme's default. */
export const formatUrl = (host: string, secure: boolean, port: number) =>
  `${secure ? "https" : "http"}://${host}${port === (secure ? 443 : 80) ? "" : `:${port}`}`;

/** URL of a host on this proxy's configured ports. */
export const urlFor = (host: string, secure = true) =>
  formatUrl(host, secure, secure ? Constants.server.httpsPort : Constants.server.httpPort);
