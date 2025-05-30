# locadot 🔐

## ✨ Features

- ✅ Automatically generates trusted local SSL certificates
- 🔁 Reverse proxies `localhost:PORT ` → `https://your.custom.domain.localhost`
- 🖥️ Works on Windows, macOS, and Linux
- 🛠️ OS-specific guidance for host setup
- ⚠️ Warns and exits if domain isn’t correctly mapped to a local IP
- ❌ Only supports proxying to localhost ports – external IPs are not allowed for security

---

## 🚀 Usage

```bash
npx locadot add --host dev.localhost --port 3350
```

---

## 📦 Commands

##### ▶️ Default (Run Proxy)

###### Starts a reverse proxy to the specified localhost port.

```bash
npx locadot add --host <custom.localhost> --port <localhost-port>
```

##### 🧾 Update existing host

###### Update domains currently registered with locadot.

```bash
npx locadot update --host <your.localhost> --port <localhost-port>
```


##### 🧾 Remove existing host

###### Remove domains currently registered with locadot.

```bash
npx locadot remove --host <your.localhost>
```

##### 🧾 View Registered Hosts

###### Displays all domains currently registered with locadot.

```bash
npx locadot host
```

##### 📺 Watch Logs

###### Continuously watches and outputs proxy logs in real time.

```bash
npx locadot watch:logs
```

##### 🧹 Clear Logs

###### Clears all saved logs.

```bash
npx locadot clear:logs
```

##### 🧹 Clear Hosts

###### Clears all existing hosts.

```bash
npx locadot clear:hosts
```

##### 🧹 Show Config Path

###### Print the path of config files used.

```bash
npx locadot path
```

##### 🧹 Show Logs Path

###### Print the path of logged files used.

```bash
npx locadot path:logs
```


##### 🧹 Show Hosts Path

###### Print the path of hosts files used.

```bash
npx locadot path:hosts
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

##### 🛑 Kill

###### Stops all running locadot hosts, clear logs and host mapping and shuts down the proxy server.

```bash
npx locadot kill
```

---

### 🙌 Contributing:

Pull requests are welcome! Feel free to open issues for bugs or feature requests. Contributions help improve locadot for everyone, so don't hesitate to get involved.

---

##### Made with ❤️ to make secure local development simple.
