# ScottiBYTE BlastRadius

**ScottiBYTE BlastRadius** is an agentless homelab dependency and impact dashboard for mapping public services, Nginx Proxy Manager routes, Incus hosts, Incus instances, nested Docker containers, DNS, and external entry points.

BlastRadius helps answer a simple question:

> If this host, container, proxy, DNS provider, or network path fails, what services are affected?

---
## Screenshot

![ScottiBYTE BlastRadius Dashboard](https://raw.githubusercontent.com/ScottiBYTE/BlastRadius/main/screenshots/Dashboard.png)

---

## What BlastRadius Discovers

BlastRadius can discover and display:

- Incus hosts and instances
- Nested Docker containers running inside Incus instances
- Nginx Proxy Manager proxy hosts
- Public service routing and ownership
- DNS provider and nameserver records
- WAN/public IP address
- Broken paths and dependency issues
- Expandable topology relationships

---

## Before You Run Docker Compose

Do these steps before running:

    docker compose up -d

You need to prepare:

1. Incus remote trust access
2. A BlastRadius configuration file
3. Nginx Proxy Manager credentials, if NPM discovery is enabled
4. UniFi credentials, if UniFi discovery is enabled
5. A Docker Compose file that mounts the config directory

---

## 1. Create Incus Remote Access

BlastRadius uses the Incus client from inside the container environment. Each Incus server must be added as a trusted remote.

On each Incus server, create a trust token:

    incus config trust add

Copy the trust token.

On the system where BlastRadius will run, add the remote:

    incus remote add incus-server-1 TRUST_TOKEN_FROM_SERVER_1

Repeat for a second server if needed:

    incus remote add incus-server-2 TRUST_TOKEN_FROM_SERVER_2

Verify both remotes work:

    incus remote list
    incus list incus-server-1:
    incus list incus-server-2:

The remote names you use here must match the names in:

    data/config.json

Example remote names used by the included template:

    incus-server-1
    incus-server-2

You can rename them to match your own environment, such as:

    vmsmist
    vmsstorm

---

## 2. Create the Configuration File

Copy the example configuration from example.config.json:

    mkdir -p data/incus-client

    cp ~/.config/incus/client.crt data/incus-client/client.crt
    cp ~/.config/incus/client.key data/incus-client/client.key

    chmod 644 data/incus-client/client.crt
    chmod 600 data/incus-client/client.key
    cp data/config.example.json data/config.json

Edit the live configuration:

    nano data/config.json

At minimum, update:

- publicDomain
- dnsDiscovery.primaryDomain
- incus.remotes
- npm.url
- npm.username
- npm.password

The example config intentionally includes only two Incus servers so it is easy to understand.

---

## 3. Example Minimal Configuration

The included file:

    data/config.example.json

uses this basic structure:

    publicDomain: example.com

    incus remotes:
      - incus-server-1
      - incus-server-2

    npm:
      url: http://npm.example.lan:81
      username: npm-readonly@example.com
      password: CHANGE_ME

    unifi:
      enabled: false
      url: https://unifi.example.lan
      username: unifi-local-account
      password: CHANGE_ME
      site: default

Do not use the example passwords. Replace every CHANGE_ME value before starting the app.

---

## 4. Nginx Proxy Manager Authorization

BlastRadius reads Nginx Proxy Manager proxy hosts and certificates.

Recommended setup:

- Create a dedicated NPM user for discovery.
- Give it enough permission to read proxy hosts and certificates.
- Avoid using your main admin account if possible.
- Store the username and password only in data/config.json.

Example placeholder values:

    npm.url: http://npm.example.lan:81
    npm.username: npm-readonly@example.com
    npm.password: CHANGE_ME

The NPM URL must be reachable from the BlastRadius container.

BlastRadius uses NPM data such as:

- Domain names
- Forward host
- Forward port
- Enabled or disabled state
- Certificate associations

---

## 5. UniFi Authorization

UniFi discovery is optional.

If you do not want UniFi discovery, leave it disabled:

    unifi.enabled: false

If you enable UniFi discovery:

- Create a dedicated local UniFi console/controller user.
- Do not use your UI.com cloud account.
- Use read-only or limited permissions if your UniFi console supports it.
- Store the local UniFi username and password only in data/config.json.
- Confirm the UniFi console is reachable from the BlastRadius container.

Example placeholder values:

    unifi.enabled: true
    unifi.url: https://unifi.example.lan
    unifi.username: unifi-local-account
    unifi.password: CHANGE_ME
    unifi.site: default
    unifi.rejectUnauthorized: false

The username above is meant to represent a local UniFi account created on the console/controller, not a UI.com cloud account email.

Use rejectUnauthorized false only when your local UniFi console uses a self-signed certificate.

---

## 6. Nested Docker Discovery

If nested Docker discovery is enabled, BlastRadius attempts to discover Docker containers running inside Incus instances.

Validate manually first:

    incus exec incus-server-1:INSTANCE_NAME -- docker ps

If that command fails manually, BlastRadius will not be able to discover Docker containers inside that instance.

Requirements:

- Incus remote is trusted
- Instance is running
- Docker is installed inside the instance
- The Incus exec context can run docker ps

---

## 7. DNS and WAN Discovery

DNS discovery usually does not require credentials.

BlastRadius can discover:

- Primary public domain
- Public nameserver records
- DNS provider label
- WAN/public IP as seen from inside the container

Validate WAN discovery from inside the running container:

    docker exec -it blastradius sh -lc "wget -qO- https://ifconfig.me/ip ; echo"

---

## 8. Docker Compose

Example docker-compose.yml:

    services:
      blastradius:
        image: scottibyte/blastradius:latest
        container_name: blastradius
        restart: unless-stopped
        ports:
          - "3050:3050"
        volumes:
          - ./data:/app/data

Start the app:

    docker compose up -d

Open:

    http://localhost:3050

---

## 9. Health Check

Check the app health endpoint:

    curl http://localhost:3050/api/health

Expected response:

    {
      "ok": true,
      "app": "ScottiBYTE BlastRadius",
      "version": "1.0.1"
    }

---

## 10. Security Notes

Before publishing to GitHub:

- Do not commit data/config.json.
- Commit data/config.example.json instead.
- Do not commit real passwords.
- Do not commit API tokens.
- Do not commit private hostnames unless you intend them to be public.
- Do not commit local backup archives or snapshot files.

The live config file should stay local:

    data/config.json

The public template is:

    data/config.example.json

---

## Version

    v1.0.1

---

## GitHub

    https://github.com/ScottiBYTE/BlastRadius

---

## Docker Hub

    scottibyte/blastradius

---

## Support

    https://www.paypal.com/paypalme/ScottiBYTE

---

## License

License details can be added before public release.
