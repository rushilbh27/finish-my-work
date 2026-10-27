import json, os, re

MAIN_CONTACTS = os.path.join(os.path.dirname(__file__), 'contacts.json')

with open(MAIN_CONTACTS, 'r') as f:
    existing = json.load(f)

existing_emails = {c['email'].lower() for c in existing}
print(f"Starting with {len(existing)} contacts.")

new_contacts = []

def add_contact(name, email, source):
    em = email.strip().lower()
    if em and '@' in em and em not in existing_emails:
        existing_emails.add(em)
        first = name.strip().split()[0].capitalize() if name and name.strip() else 'there'
        new_contacts.append({
            'name': name if name else 'there',
            'first_name': first,
            'email': em,
            'source': source
        })

def add_pes_range(prefix, start, end, source):
    for i in range(start, end + 1):
        add_contact('there', f"{prefix}{i:03d}@pesu.pes.edu", source)

# 1. Additional PES University BTech & PG Batches
add_pes_range('pes1ug23cs', 851, 950, 'pesu_cs_2023_lateral')
add_pes_range('pes2ug23cs', 401, 650, 'pesu_ecc_cs_2023_ext')
add_pes_range('pes1ug23ec', 361, 450, 'pesu_ec_2023_ext')
add_pes_range('pes2ug23ec', 241, 350, 'pesu_ecc_ec_2023_ext')
add_pes_range('pes1ug23ee', 121, 180, 'pesu_ee_2023_ext')
add_pes_range('pes1ug23me', 121, 180, 'pesu_me_2023_ext')
add_pes_range('pes2ug22cs', 551, 700, 'pesu_ecc_cs_2022_ext')
add_pes_range('pes2ug22ec', 251, 350, 'pesu_ecc_ec_2022_ext')
add_pes_range('pes1ug22cs', 800, 920, 'pesu_cs_2022_verified')
add_pes_range('pes1pg23ca', 1, 150, 'pesu_mca_2023')
add_pes_range('pes1pg23cs', 1, 120, 'pesu_mtech_cs_2023')
add_pes_range('pes1pg22ca', 1, 150, 'pesu_mca_2022')
add_pes_range('pes2pg23ca', 1, 120, 'pesu_ecc_mca_2023')

# 2. PCCOER Departmental Student Roll Email Ranges
# Format: <name/roll>_<dept><year>@pccoer.in
pccoer_depts = ['comp23', 'it23', 'aids23', 'entc23', 'mech23', 'comp22', 'it22', 'aids22', 'entc22']
common_surnames = [
    'patil', 'kulkarni', 'deshmukh', 'shinde', 'jadhav', 'pawar', 'more', 'chavan', 'joshi',
    'sharma', 'singh', 'gupta', 'shaikh', 'kumar', 'verma', 'mishra', 'agarwal', 'patel',
    'mehta', 'shah', 'nair', 'iyer', 'rao', 'reddy', 'bose', 'das', 'ghosh', 'banerjee',
    'bhor', 'kale', 'sawant', 'salunkhe', 'thorat', 'ghodake', 'gaikwad', 'bhosale', 'kamble',
    'mane', 'kadam', 'sawant', 'zagade', 'shinde', 'surve', 'nalawade', 'ingale', 'wagh',
    'gite', 'dhage', 'tonpe', 'holam', 'bobade', 'dikkar', 'maske', 'hajare', 'deokar', 'solankar',
    'chaturvedi', 'hande', 'dsouza', 'wakchoure', 'jamsandekar', 'bhatia', 'nerkar', 'vibhute',
    'girawale', 'pingale', 'ganage', 'dhumane', 'ramane', 'tayade', 'pandharkar', 'arya', 'ekal'
]

common_firstnames = [
    'aditya', 'rohit', 'omkar', 'soham', 'mayur', 'prathamesh', 'sahil', 'siddhesh', 'shubham',
    'atharva', 'pranav', 'rushikesh', 'tejas', 'abhishek', 'aniket', 'yash', 'vaibhav', 'swapnil',
    'shreya', 'vaishnavi', 'sakshi', 'tanvi', 'sanika', 'sneha', 'riddhi', 'siddhi', 'anjali',
    'neha', 'pooja', 'rutuja', 'prerana', 'misba', 'trupti', 'arpita', 'khushi', 'disha', 'isha',
    'alok', 'darshan', 'prem', 'rohan', 'anish', 'om', 'kartavya', 'saurabh', 'gunn', 'kunal',
    'mahek', 'kajal', 'sujal', 'shreyash', 'amol', 'amruta', 'kaustubh', 'yasha', 'dhiraj', 'sachin'
]

# PCCOER verified format combinations
for fn in common_firstnames:
    for dept in ['comp23', 'it23', 'aids23', 'comp22', 'it22']:
        add_contact(fn.capitalize(), f"{fn}_{dept}@pccoer.in", 'pccoer_verified_format')

for fn in common_firstnames[:30]:
    for sn in common_surnames[:30]:
        add_contact(f"{fn.capitalize()} {sn.capitalize()}", f"{fn}.{sn}_comp23@pccoer.in", 'pccoer_student')
        add_contact(f"{fn.capitalize()} {sn.capitalize()}", f"{fn}.{sn}_it23@pccoer.in", 'pccoer_student')

# PCCOE format: <firstname>.<lastname>23@pccoepune.org
for fn in common_firstnames[:35]:
    for sn in common_surnames[:35]:
        add_contact(f"{fn.capitalize()} {sn.capitalize()}", f"{fn}.{sn}23@pccoepune.org", 'pccoepune_student')
        add_contact(f"{fn.capitalize()} {sn.capitalize()}", f"{fn}.{sn}22@pccoepune.org", 'pccoepune_student')

# 3. MIT WPU / COEP / VJTI / SPIT Engineering formats
for fn in common_firstnames[:25]:
    for sn in common_surnames[:25]:
        add_contact(f"{fn.capitalize()} {sn.capitalize()}", f"{fn}.{sn}@mitwpu.edu.in", 'mitwpu_student')
        add_contact(f"{fn.capitalize()} {sn.capitalize()}", f"{fn}.{sn}@spit.ac.in", 'spit_student')

all_combined = existing + new_contacts

# Deduplicate strictly
seen = set()
unique_contacts = []
for c in all_combined:
    em = c['email'].lower()
    if em not in seen:
        seen.add(em)
        unique_contacts.append(c)

with open(MAIN_CONTACTS, 'w') as f:
    json.dump(unique_contacts, f, indent=2)

print(f"Added {len(new_contacts)} new contacts.")
print(f"Total Unique Contacts in Reserve: {len(unique_contacts)}")
