import os
import sys
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

# Import the outreach fleet runner
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))

try:
    from send_outreach import run_persistent_outreach_fleet, load_sent_log, CONTACTS_PATH
except ImportError:
    from new_send_outreach import run_persistent_outreach_fleet, load_sent_log, CONTACTS_PATH

PORT = int(os.environ.get("PORT", 10000))

class OutreachHealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ["/", "/health", "/healthz"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            sent_count = len(load_sent_log())
            res = {
                "status": "online",
                "service": "6-sender-outreach-fleet",
                "sent_count": sent_count,
                "timestamp": datetime.now().isoformat(),
                "uptime_robot_status": "OK"
            }
            self.wfile.write(json.dumps(res, indent=2).encode('utf-8'))
        elif self.path == "/stats":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            try:
                with open(CONTACTS_PATH, 'r') as f:
                    total_contacts = len(json.load(f))
            except Exception:
                total_contacts = 0
            sent_count = len(load_sent_log())
            res = {
                "total_contacts": total_contacts,
                "sent_count": sent_count,
                "pending_count": max(0, total_contacts - sent_count),
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(res, indent=2).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def log_message(self, format, *args):
        # Quiet standard HTTP access logs to keep terminal / cloud logs clean
        return

def start_server():
    server = HTTPServer(("0.0.0.0", PORT), OutreachHealthHandler)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Render Health Server running on port {PORT} (UptimeRobot ready)")
    sys.stdout.flush()
    server.serve_forever()

if __name__ == "__main__":
    # Start the continuous email dispatch worker in a background daemon thread
    worker_thread = threading.Thread(target=run_persistent_outreach_fleet, daemon=True)
    worker_thread.start()
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Background email fleet thread launched.")

    # Start the HTTP health server on the main thread for Render & UptimeRobot
    start_server()
