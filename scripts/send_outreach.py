import os
import sys
import time
import json
import random
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ==============================================================================
# SENDER FLEET CONFIGURATION & QUOTA PRESERVATION
# ==============================================================================
SENDERS = [
    {"email": "rushilbhor27@gmail.com", "pass": "qauycsskrjzgrjat", "name": "Rushil"},
    {"email": "cashcourse77@gmail.com", "pass": "bilvgwzveumeblvm", "name": "Rushil"},
    {"email": "rushilbhor@gmail.com", "pass": "poarjcgiexoqfyfj", "name": "Rushil"},
    {"email": "yourgrowthmedia1@gmail.com", "pass": "urwkryifcoiaktoy", "name": "Rushil"},
    {"email": "rushil.sociovate@gmail.com", "pass": "otplufwzxrtlwllz", "name": "Rushil"},
    {"email": "vishnubhor1970@gmail.com", "pass": "ujtqoicxwmrhmydt", "name": "Rushil"}
]

# Strict Quota Reservation Rules:
# Free Gmail rolling 24-hour SMTP limit: ~500 emails.
# Requirement: Spare 20 emails strictly for personal use on rushilbhor27@gmail.com & rushilbhor@gmail.com.
# 500 - 20 = 480 outreach emails max per rolling 24 hours.
ACCOUNT_QUOTAS = {
    "rushilbhor27@gmail.com": {"max_daily": 480, "spare": 20, "label": "Rushil (Primary)"},
    "rushilbhor@gmail.com": {"max_daily": 480, "spare": 20, "label": "Rushil (Personal)"},
    "cashcourse77@gmail.com": {"max_daily": 495, "spare": 5, "label": "CashCourse Fleet"},
    "yourgrowthmedia1@gmail.com": {"max_daily": 495, "spare": 5, "label": "GrowthMedia Fleet"},
    "rushil.sociovate@gmail.com": {"max_daily": 495, "spare": 5, "label": "Sociovate Fleet"},
    "vishnubhor1970@gmail.com": {"max_daily": 495, "spare": 5, "label": "Vishnu Fleet"},
}

EXTENSION_LINK = 'https://github.com/rushilbh27/finish-my-work'

def resolve_path(filename):
    """Finds the correct path for data files across scripts/ and root dirs."""
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), filename),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts', filename),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts', filename),
        os.path.join(os.getcwd(), filename),
        os.path.join(os.getcwd(), 'scripts', filename),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    # Default to directory beside script
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)

CONTACTS_PATH = resolve_path('contacts.json')
LOG_PATH = resolve_path('outreach_log.json')
HISTORY_PATH = resolve_path('sender_history.json')

def atomic_save_json(filepath, data):
    """Safely writes JSON using a temp file to prevent corruption on sudden termination."""
    tmp_path = filepath + '.tmp'
    try:
        with open(tmp_path, 'w') as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_path, filepath)
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error saving {filepath}: {e}")

def load_sent_log():
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH, 'r') as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_sent_log(sent_set):
    atomic_save_json(LOG_PATH, list(sent_set))

def load_sender_history():
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_sender_history(history):
    atomic_save_json(HISTORY_PATH, history)

def get_sender_stats(email, history):
    """Returns (used_24h, max_limit, spare_reserved) for an account."""
    email = email.lower()
    now = time.time()
    cutoff = now - 86400  # 24 hours rolling
    timestamps = history.get(email, [])
    valid_ts = [ts for ts in timestamps if ts >= cutoff]
    
    cfg = ACCOUNT_QUOTAS.get(email, {"max_daily": 495, "spare": 5})
    return len(valid_ts), cfg["max_daily"], cfg["spare"]

def record_sender_dispatch(email, history):
    """Logs an email dispatch timestamp and writes to persistent storage."""
    email = email.lower()
    now = time.time()
    cutoff = now - 86400
    if email not in history:
        history[email] = []
    history[email] = [ts for ts in history[email] if ts >= cutoff]
    history[email].append(now)
    save_sender_history(history)

def connect_sender(account):
    """Creates an authenticated SMTP TLS session to Gmail."""
    try:
        s = smtplib.SMTP('smtp.gmail.com', 587, timeout=15)
        s.ehlo()
        s.starttls()
        s.ehlo()
        s.login(account['email'], account['pass'])
        return s
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Failed to connect {account['email']}: {e}")
        return None

def run_persistent_outreach_fleet():
    print(f"\n{'='*70}")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 24/7 Automated Outreach Fleet Initialized")
    print(f"Contacts source: {CONTACTS_PATH}")
    print(f"Sent log path:   {LOG_PATH}")
    print(f"History tracker: {HISTORY_PATH}")
    print(f"Strict Quota Guard Active:")
    for email, q in ACCOUNT_QUOTAS.items():
        print(f"  • {email:30s} -> Cap: {q['max_daily']}/day | Spared for user: {q['spare']} emails")
    print(f"{'='*70}")
    sys.stdout.flush()

    cooldowns = {}  # {email: timestamp_until_cooldown_expires}

    while True:
        try:
            with open(CONTACTS_PATH, 'r') as f:
                contacts = json.load(f)
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error loading contacts from {CONTACTS_PATH}: {e}")
            time.sleep(30)
            continue

        sent_set = load_sent_log()
        history = load_sender_history()
        
        pending = [c for c in contacts if c['email'].lower() not in sent_set]
        
        print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Database Status: Total: {len(contacts)} | Sent: {len(sent_set)} | Pending: {len(pending)}")
        sys.stdout.flush()

        if not pending:
            print("🎉 ALL CONTACTS IN DATABASE REACHED! Outreach campaign 100% complete.")
            break

        # Check each sender for quota allowances & cooldowns
        now = time.time()
        active_senders = []

        for acct in SENDERS:
            email = acct['email'].lower()
            used_24h, max_daily, spare = get_sender_stats(email, history)
            
            # Check 20-email reservation guard
            if used_24h >= max_daily:
                print(f"[QUOTA GUARD] {email:30s} at daily cap ({used_24h}/{max_daily}). Sparing {spare} emails for personal use. [RESTING]")
                continue
                
            # Check cooldown from Google 550 rate limit
            if email in cooldowns and now < cooldowns[email]:
                remaining_cd = int(cooldowns[email] - now)
                print(f"[COOLDOWN]    {email:30s} cooling down from Google limit ({remaining_cd}s remaining) [RESTING]")
                continue

            # Connect active sender
            server = connect_sender(acct)
            if server:
                active_senders.append({
                    "config": acct,
                    "server": server,
                    "sent_count": 0
                })
                print(f"[ONLINE]      {email:30s} Ready ({used_24h}/{max_daily} sent in last 24h)")
            else:
                cooldowns[email] = now + 300  # Retry connect in 5 min

        if not active_senders:
            print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] All senders are either at their daily cap (sparing personal emails) or in cooldown.")
            print(f"Entering sleep cycle. Next fleet probe in 15 minutes...")
            sys.stdout.flush()
            time.sleep(900)
            continue

        print(f"\n{len(active_senders)} sender units actively disembarking emails across pending student contacts...")
        sys.stdout.flush()

        sender_idx = 0
        quota_hit_this_round = False

        for contact in pending:
            if not active_senders:
                print(f"\n[!] All active senders reached their daily quotas or limits for this cycle.")
                quota_hit_this_round = True
                break

            current = active_senders[sender_idx % len(active_senders)]
            acct = current['config']
            server = current['server']
            email_sender = acct['email'].lower()

            # Pre-check 24h cap before each dispatch
            used_24h, max_daily, spare = get_sender_stats(email_sender, history)
            if used_24h >= max_daily:
                print(f"\n[QUOTA GUARD] {email_sender} reached {used_24h}/{max_daily} emails. Strictly reserving {spare} emails for user. Retiring unit.")
                try: server.quit()
                except Exception: pass
                active_senders.remove(current)
                continue

            recipient_email = contact['email'].lower().strip()
            name = contact.get('first_name') or contact.get('name') or 'there'
            if not name or name.lower() == 'there':
                name = 'there'
            else:
                name = name.split()[0].capitalize()

            msg = MIMEMultipart()
            msg['From'] = f"{acct['name']} <{acct['email']}>"
            msg['To'] = recipient_email
            msg['Subject'] = "tool for LMS assignments (2027 batch)"

            body = f"""Hey {name},

Saw you're in the 2027 batch.

If you guys also lose hours every week manually calculating stats and tables for LMS assignments before the deadline, I built a Chrome extension that solves and fills the MCQs/MSQs in 1 click.

It reads the data tables and math directly on the page so you don't have to calculate standard deviation or covariance manually.

It's free: {EXTENSION_LINK}

Figured it might save you some time. Let me know if it helps.

Rushil"""

            msg.attach(MIMEText(body, 'plain'))

            try:
                server.sendmail(acct['email'], recipient_email, msg.as_string())
                
                # Update sent log and sender history atomically
                sent_set.add(recipient_email)
                save_sent_log(sent_set)
                
                record_sender_dispatch(email_sender, history)
                current['sent_count'] += 1
                used_now, _, spare_val = get_sender_stats(email_sender, history)

                delay = random.uniform(2.5, 4.0)
                print(f"[{email_sender} | Sent: {len(sent_set)}/{len(contacts)} | 24h: {used_now}/{max_daily} ({spare_val} spared)] -> {recipient_email} ({name}) | +{delay:.1f}s")
                sys.stdout.flush()
                time.sleep(delay)
                sender_idx += 1

            except smtplib.SMTPDataError as de:
                err_str = str(de)
                if 'quota' in err_str.lower() or '550' in err_str or '452' in err_str or 'daily user sending limit' in err_str.lower():
                    print(f"\n[!] Daily Google quota reached on {email_sender}. Placing on 4-hour cooldown.")
                    cooldowns[email_sender] = time.time() + 14400
                    try: server.quit()
                    except Exception: pass
                    active_senders.remove(current)
                else:
                    print(f"SMTP Data error on {email_sender}: {de}")
                    time.sleep(5)
                    sender_idx += 1

            except Exception as e:
                err_str = str(e)
                if 'quota' in err_str.lower() or 'daily user sending limit' in err_str.lower():
                    print(f"\n[!] Daily Google quota reached on {email_sender}. Placing on 4-hour cooldown.")
                    cooldowns[email_sender] = time.time() + 14400
                    try: server.quit()
                    except Exception: pass
                    active_senders.remove(current)
                else:
                    print(f"Notice on {email_sender}: {e}. Reconnecting...")
                    try: server.quit()
                    except Exception: pass
                    new_server = connect_sender(acct)
                    if new_server:
                        current['server'] = new_server
                    else:
                        active_senders.remove(current)
                    time.sleep(4)

        # Cleanup any open connections at end of cycle
        for s in active_senders:
            try: s['server'].quit()
            except Exception: pass

        if quota_hit_this_round or not active_senders:
            print(f"\n{'='*70}")
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Daily allowance exhausted across available accounts.")
            print(f"Entering continuous standby check (checks every 15 mins). Automatically resumes once allowances roll over.")
            print(f"{'='*70}\n")
            sys.stdout.flush()
            time.sleep(900)

if __name__ == '__main__':
    run_persistent_outreach_fleet()
