import json, os

MAIN_CONTACTS = os.path.join(os.path.dirname(__file__), 'contacts.json')

with open(MAIN_CONTACTS, 'r') as f:
    existing = json.load(f)

existing_emails = {c['email'].lower() for c in existing}
print(f"Starting with {len(existing)} existing contacts.")

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

# 1. VIT (Vellore Institute of Technology - VTOP / Moodle LMS)
# Format: <yy><branch><4_digit_roll>@vitstudent.ac.in
def add_vit(branch, year, start, end):
    src = f'vit_{branch}_{year}'
    for i in range(start, end + 1):
        add_contact('there', f"{year}{branch}{i:04d}@vitstudent.ac.in", src)

# 2023 Batch VIT
add_vit('bce', '23', 1, 3500)  # CSE
add_vit('bit', '23', 1, 1000)  # IT
add_vit('bds', '23', 1, 1000)  # Data Science
add_vit('bec', '23', 1, 1500)  # ECE
add_vit('bme', '23', 1, 1000)  # Mech
add_vit('bee', '23', 1, 800)   # EEE

# 2022 Batch VIT
add_vit('bce', '22', 1, 3500)  # CSE
add_vit('bit', '22', 1, 1000)  # IT
add_vit('bds', '22', 1, 1000)  # Data Science
add_vit('bec', '22', 1, 1500)  # ECE
add_vit('bme', '22', 1, 1000)  # Mech

# 2021 Batch VIT
add_vit('bce', '21', 1, 3000)  # CSE
add_vit('bec', '21', 1, 1500)  # ECE
add_vit('bit', '21', 1, 800)   # IT

# 2. SRM Institute of Science & Technology (RA Registration schema)
# Format: ra<yy>11003<dept><num>@srmist.edu.in
def add_srm(code, start, end, label):
    for i in range(start, end + 1):
        add_contact('there', f"{code}{i:04d}@srmist.edu.in", label)

add_srm('ra231100301', 1, 1500, 'srm_cse_2023')
add_srm('ra231100302', 1, 1200, 'srm_aiml_2023')
add_srm('ra231100303', 1, 800,  'srm_it_2023')
add_srm('ra231100401', 1, 1000, 'srm_ece_2023')
add_srm('ra221100301', 1, 1500, 'srm_cse_2022')
add_srm('ra221100302', 1, 1200, 'srm_aiml_2022')
add_srm('ra221100401', 1, 1000, 'srm_ece_2022')
add_srm('ra211100301', 1, 1500, 'srm_cse_2021')

# 3. BITS Pilani Additional Campuses & Batches
for yr in ['2024', '2021']:
    for i in range(1, 1601):
        add_contact('there', f"f{yr}{i:04d}@pilani.bits-pilani.ac.in", f'bits_pilani_{yr}')
    for i in range(1, 1301):
        add_contact('there', f"f{yr}{i:04d}@goa.bits-pilani.ac.in", f'bits_goa_{yr}')
    for i in range(1, 1501):
        add_contact('there', f"f{yr}{i:04d}@hyderabad.bits-pilani.ac.in", f'bits_hyd_{yr}')

# 4. Bennett University Additional Batches
for i in range(1, 1601): add_contact('there', f"e24cseu{i:04d}@bennett.edu.in", 'bennett_cs_2024')
for i in range(1, 401):  add_contact('there', f"e24aimlu{i:04d}@bennett.edu.in", 'bennett_aiml_2024')
for i in range(1, 351):  add_contact('there', f"e24eceu{i:04d}@bennett.edu.in", 'bennett_ec_2024')
for i in range(1, 1201): add_contact('there', f"e20cseu{i:04d}@bennett.edu.in", 'bennett_cs_2020')

# 5. KIIT University Additional Batches
for i in range(1, 1000): add_contact('there', f"2405{i:03d}@kiit.ac.in", 'kiit_cs_2024')
for i in range(1, 601):  add_contact('there', f"2406{i:03d}@kiit.ac.in", 'kiit_it_2024')
for i in range(1, 1000): add_contact('there', f"2005{i:03d}@kiit.ac.in", 'kiit_cs_2020')

# 6. Thapar Institute (TIET - Webkiosk / Moodle)
for i in range(1, 1000): add_contact('there', f"102403{i:03d}@thapar.edu", 'thapar_cs_2024')
for i in range(1, 1000): add_contact('there', f"102103{i:03d}@thapar.edu", 'thapar_cs_2021')
for i in range(1, 601):  add_contact('there', f"102308{i:03d}@thapar.edu", 'thapar_ec_2023')

all_combined = existing + new_contacts
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
