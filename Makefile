DC        := sg docker -c "docker compose"
MOBILE    := cd mobile &&
HOST_IP   := $(shell hostname -I | awk '{print $$1}')
WIN_IP    := $(shell ipconfig.exe 2>/dev/null | grep "IPv4" | awk '{print $$NF}' | tr -d '\r' | grep "^192\.168\." | head -1)

.PHONY: up down restart logs status health \
        api-logs db-logs nginx-logs \
        db-shell api-shell \
        mobile android ios iphone port-forward port-forward-clean \
        reset clean help

# ── Primary commands ──────────────────────────────────────────

## Start backend (api + db + nginx) — main entry point
up:
	@echo "Starting backend services (HOST_IP=$(HOST_IP))..."
	@$(DC) up -d api db nginx
	@echo "Waiting for API to be ready..."
	@for i in $$(seq 1 15); do \
		curl -sf http://localhost:4000/health > /dev/null && echo "✓ API is up → http://localhost:4000" && break; \
		echo "  waiting... ($$i/15)"; sleep 2; \
	done

## Stop all services
down:
	@$(DC) down

## Restart backend services
restart:
	@$(DC) restart api nginx

## Show running containers and ports
status:
	@$(DC) ps

## Tail logs from all backend services
logs:
	@$(DC) logs -f api db nginx

## Hit the health endpoints
health:
	@echo "--- Nginx  ---" && curl -s http://localhost/health
	@echo "\n--- API    ---" && curl -s http://localhost:4000/health | python3 -m json.tool
	@echo "--- API/DB ---" && curl -s http://localhost/api/health | python3 -m json.tool

# ── Per-service logs ──────────────────────────────────────────

api-logs:
	@$(DC) logs -f api

db-logs:
	@$(DC) logs -f db

nginx-logs:
	@$(DC) logs -f nginx

# ── Shells ────────────────────────────────────────────────────

## Open a psql shell inside the running DB container
db-shell:
	@sg docker -c "docker exec -it zamin_db psql -U zamin -d zamin_db"

## Open a shell inside the running API container
api-shell:
	@sg docker -c "docker exec -it zamin_api sh"

# ── Mobile ────────────────────────────────────────────────────

## Start Expo dev server (update HOST_IP in mobile/.env first if needed)
mobile:
	@echo "Starting Expo (HOST_IP=$(HOST_IP))..."
	@sed -i "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$(HOST_IP)/api|" mobile/.env
	@$(MOBILE) npx expo start

## Open on Android emulator / device
android:
	@$(MOBILE) npx expo start --android

## Open on iOS simulator
ios:
	@$(MOBILE) npx expo start --ios

## Test on a real iPhone via Expo Go (WSL2 + LAN)
## Requires port forwarding — run `make port-forward` first (PowerShell Admin)
iphone:
	@echo ""
	@echo "  Windows LAN IP : $(WIN_IP)"
	@echo "  WSL2 IP        : $(HOST_IP)"
	@echo ""
	@if [ -z "$(WIN_IP)" ]; then echo "ERROR: Could not detect Windows LAN IP. Are you on WiFi?"; exit 1; fi
	@sed -i "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$(WIN_IP)/api|" mobile/.env
	@echo "  API URL set to : http://$(WIN_IP)/api"
	@echo ""
	@echo "  Scan the QR code below with Expo Go on your iPhone."
	@echo "  (Make sure iPhone is on the same WiFi as this machine)"
	@echo ""
	@cd mobile && REACT_NATIVE_PACKAGER_HOSTNAME=$(WIN_IP) npx expo start --lan

## Print the PowerShell (Admin) commands needed for WSL2 → Windows port forwarding
port-forward:
	@echo ""
	@echo "  Run these commands in PowerShell as Administrator:"
	@echo ""
	@echo "  netsh interface portproxy add v4tov4 listenport=8081  listenaddr=0.0.0.0 connectport=8081  connectaddress=$(HOST_IP)"
	@echo "  netsh interface portproxy add v4tov4 listenport=19000 listenaddr=0.0.0.0 connectport=19000 connectaddress=$(HOST_IP)"
	@echo "  netsh interface portproxy add v4tov4 listenport=80    listenaddr=0.0.0.0 connectport=80    connectaddress=$(HOST_IP)"
	@echo "  netsh advfirewall firewall add rule name=\"WSL2 Zamin\" dir=in action=allow protocol=TCP localport=8081,19000,80"
	@echo ""
	@echo "  To remove later: make port-forward-clean"
	@echo ""

## Remove the Windows port forwarding rules (PowerShell Admin)
port-forward-clean:
	@echo ""
	@echo "  Run these commands in PowerShell as Administrator:"
	@echo ""
	@echo "  netsh interface portproxy delete v4tov4 listenport=8081  listenaddr=0.0.0.0"
	@echo "  netsh interface portproxy delete v4tov4 listenport=19000 listenaddr=0.0.0.0"
	@echo "  netsh interface portproxy delete v4tov4 listenport=80    listenaddr=0.0.0.0"
	@echo "  netsh advfirewall firewall delete rule name=\"WSL2 Zamin\""
	@echo ""

# ── Full stack ────────────────────────────────────────────────

## Start backend then Expo — run `make dev` to test the full app
dev: up mobile

# ── Database ──────────────────────────────────────────────────

## Wipe the DB volume and restart fresh (re-runs init.sql)
reset:
	@echo "WARNING: This will delete all data. Press Ctrl-C to cancel, Enter to continue."
	@read _
	@$(DC) down -v
	@$(DC) up -d api db nginx

# ── Cleanup ───────────────────────────────────────────────────

## Stop services and remove containers (keeps DB volume)
clean:
	@$(DC) down --remove-orphans

# ── Help ──────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  Zamin — available make targets"
	@echo ""
	@echo "  Backend"
	@echo "    make up          Start api + db + nginx"
	@echo "    make down        Stop all services"
	@echo "    make restart     Restart api + nginx (not db)"
	@echo "    make status      Show container status"
	@echo "    make logs        Tail all backend logs"
	@echo "    make health      Hit health endpoints"
	@echo ""
	@echo "  Per-service logs"
	@echo "    make api-logs    Tail API logs"
	@echo "    make db-logs     Tail DB logs"
	@echo "    make nginx-logs  Tail Nginx logs"
	@echo ""
	@echo "  Shells"
	@echo "    make db-shell    psql into zamin_db"
	@echo "    make api-shell   sh into zamin_api"
	@echo ""
	@echo "  Mobile"
	@echo "    make mobile           Start Expo dev server (web)"
	@echo "    make iphone           Expo Go on real iPhone (LAN)"
	@echo "    make android          Expo → Android"
	@echo "    make ios              Expo → iOS simulator"
	@echo "    make port-forward     Print WSL2 port-forward commands"
	@echo "    make port-forward-clean  Print cleanup commands"
	@echo ""
	@echo "  Full stack"
	@echo "    make dev         up + mobile (web)"
	@echo ""
	@echo "  Database"
	@echo "    make reset       Wipe DB volume and restart fresh"
	@echo ""
	@echo "  Cleanup"
	@echo "    make clean       Stop and remove containers"
	@echo ""
