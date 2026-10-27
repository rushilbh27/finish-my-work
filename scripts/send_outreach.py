import os
import sys
import time
import json
import random
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SENDERS = [
    {"email": "rushilbhor27@gmail.com", "pass": "qauycsskrjzgrjat", "name": "Rushil"},
    {"email": "cashcourse77@gmail.com", "pass": "bilvgwzveumeblvm", "name": "Rushil"},
    {"email": "rushilbhor@gmail.com", "pass": "poarjcgiexoqfyfj", "name": "Rushil"},
    {"email": "yourgrowthmedia1@gmail.com", "pass": "urwkryifcoiaktoy", "name": "Rushil"},
    {"email": "rushil.sociovate@gmail.com", "pass": "otplufwzxrtlwllz", "name": "Rushil"},
    {"email": "vishnubhor1970@gmail.com", "pass": "ujtqoicxwmrhmydt", "name": "Rushil"}
]

EXTENSION_LINK = 'https://github.com/rushilbh27/finish-my-work'
CONTACTS_PATH = os.path.join(os.path.dirname(__file__), 'contacts.json')
LOG_PATH = os.path.join(os.path.dirname(__file__), 'outreach_log.json')

def load_sent_log():
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH, 'r') as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_sent_log(sent_set):
    with open(LOG_PATH, 'w') as f:
        json.dump(list(sent_set), f, indent=2)

def connect_sender(account):
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

def test_sender_quota(account):
    """Quick probe to see if the sender has reset and can send."""
    s = connect_sender(account)
    if not s:
        return False
    try:
        s.quit()
        return True
    except Exception:
        return False

def run_persistent_outreach_fleet():
    print(f"\n{'='*60}")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 6-Sender Continuous High-Velocity Fleet Starting")
    print(f"{'='*60}")
    sys.stdout.flush()

    while True:
        with open(CONTACTS_PATH, 'r') as f:
            contacts = json.load(f)
            
        sent_set = load_sent_log()
        pending = [c for c in contacts if c['email'].lower() not in sent_set]
        
        print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Database Status: Total: {len(contacts)} | Sent: {len(sent_set)} | Pending: {len(pending)}")
        
        if not pending:
            print("🎉 ALL CONTACTS HAVE BEEN REACHED! Outreach campaign 100% complete.")
            break

        # Connect all available senders
        active_senders = []
        for acct in SENDERS:
            server = connect_sender(acct)
            if server:
                active_senders.append({
                    "config": acct,
                    "server": server,
                    "sent_count": 0
                })
                print(f"Fleet Unit Ready: {acct['email']} [ONLINE]")

        if not active_senders:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] No senders could connect right now. Checking back in 15 minutes...")
            sys.stdout.flush()
            time.sleep(900)
            continue

        print(f"\n{len(active_senders)} sender units active. Commencing round-robin dispatch across prioritized @gmail.com contacts...")
        sys.stdout.flush()

        sender_idx = 0
        quota_hit_this_round = False
        
        for contact in pending:
            if not active_senders:
                print(f"\n[!] All sender accounts have reached their daily quotas (~3,000 sent today).")
                quota_hit_this_round = True
                break
                
            current = active_senders[sender_idx % len(active_senders)]
            acct = current['config']
            server = current['server']
            
            email = contact['email'].lower().strip()
            name = contact.get('first_name') or contact.get('name') or 'there'
            if not name or name.lower() == 'there':
                name = 'there'
            else:
                name = name.split()[0].capitalize()
                
            msg = MIMEMultipart()
            msg['From'] = f"{acct['name']} <{acct['email']}>"
            msg['To'] = email
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
                server.sendmail(acct['email'], email, msg.as_string())
                sent_set.add(email)
                save_sent_log(sent_set)
                current['sent_count'] += 1
                
                # Global safe jitter: 2.2 - 3.8s across round-robin fleet
                delay = random.uniform(2.2, 3.8)
                print(f"[{acct['email']} | Total: {len(sent_set)}/{len(contacts)}] Sent -> {email} ({name}) | next {delay:.1f}s")
                sys.stdout.flush()
                time.sleep(delay)
                sender_idx += 1
                
            except smtplib.SMTPDataError as de:
                err_str = str(de)
                if 'quota' in err_str.lower() or '550' in err_str or '452' in err_str or 'daily user sending limit' in err_str.lower():
                    print(f"\n[!] Daily quota reached on {acct['email']}. Retiring unit for this cycle.")
                    try: server.quit()
                    except Exception: pass
                    active_senders.remove(current)
                else:
                    print(f"SMTP Data error on {acct['email']}: {de}")
                    time.sleep(4)
            except Exception as e:
                err_str = str(e)
                if 'quota' in err_str.lower() or 'daily user sending limit' in err_str.lower():
                    print(f"\n[!] Daily quota reached on {acct['email']}. Retiring unit for this cycle.")
                    try: server.quit()
                    except Exception: pass
                    active_senders.remove(current)
                else:
                    print(f"Notice on {acct['email']}: {e}. Reconnecting...")
                    try: server.quit()
                    except Exception: pass
                    new_server = connect_sender(acct)
                    if new_server:
                        current['server'] = new_server
                    else:
                        active_senders.remove(current)

        for s in active_senders:
            try: s['server'].quit()
            except Exception: pass

        if quota_hit_this_round or not active_senders:
            print(f"\n{'='*60}")
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Daily limit reached (~3,000 sent today). Entering continuous standby.")
            print(f"Fleet will sleep and probe every 30 minutes. Once Google resets sending allowances, dispatching resumes automatically!")
            print(f"{'='*60}\n")
            sys.stdout.flush()

            # Continuous standby check loop
            while True:
                time.sleep(1800)  # Probe every 30 minutes
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Probing sender fleet reset status...")
                sys.stdout.flush()
                reset_count = sum(1 for acct in SENDERS if test_sender_quota(acct))
                if reset_count >= 2:
                    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {reset_count} accounts reset and available! Resuming dispatch...")
                    sys.stdout.flush()
                    break
                else:
                    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Quotas still cooling down. Next probe in 30 minutes.")
                    sys.stdout.flush()

if __name__ == '__main__':
    run_persistent_outreach_fleet()
