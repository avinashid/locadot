# locadot 🔐

## ✨ Features

- ✅ Automatically generates trusted local SSL certificates
- 🔁 Reverse proxies `https://your.custom.domain` → `localhost:your-port`
- 🖥️ Works on Windows, macOS, and Linux
- 🛠️ OS-specific guidance for host setup
- ⚠️ Warns and exits if domain isn’t correctly mapped to a local IP
- ❌ Only supports proxying to localhost ports – external IPs are not allowed for security

---

## 🚀 Usage

```bash
npx locadot --host dev.localhost --port 3350
```

---

## 📦 Commands

##### ▶️ Default (Run Proxy)

###### Starts a reverse proxy to the specified localhost port.

```bash
npx locadot --host <custom.localhost> --port <localhost-port>
```

##### 🧾 View Registered Hosts

###### Displays all domains currently registered with locadot.

```bash
npx locadot host
```

##### 📺 Watch Logs

###### Continuously watches and outputs proxy logs in real time.

```bash
npx locadot log
```

##### 🧹 Clear Logs

###### Clears all saved logs.

```bash
npx locadot clear logs
```

##### 🔄 Restart Proxy

###### Restarts the proxy server and reloads configuration.

```bash
npx locadot restart
```

##### 🛑 Stop All

###### Stops all running locadot hosts and shuts down the proxy server.

```bash
npx locadot stop
```

---

### 🙌 Contributing:

Pull requests are welcome! Feel free to open issues for bugs or feature requests. Contributions help improve locadot for everyone, so don't hesitate to get involved.

---

##### Made with ❤️ to make secure local development simple.
