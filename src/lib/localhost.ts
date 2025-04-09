import https from "https";
export default class Localhost {
  static async isLocalhostOpen(domain: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: "localhost",
          port,
          method: "HEAD",
          rejectUnauthorized: false,
          timeout: 1000,
          headers: {
            Host: domain,
          },
        },
        (res) => {
          resolve(res.statusCode! >= 200 && res.statusCode! < 400);
          res.destroy();
        }
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  static isValidLocalhostDomain(domain: string): boolean {
    const localhostPattern = /^(?:[a-zA-Z0-9-]+\.)*localhost$/;
    return localhostPattern.test(domain);
  }
}
