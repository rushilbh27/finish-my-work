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

# 1. PES University Expand
def add_pes(prefix, start, end, src):
    for i in range(start, end + 1):
        add_contact('there', f"{prefix}{i:03d}@pesu.pes.edu", src)

add_pes('pes1ug23cs', 1, 920, 'pesu_cs_2023')
add_pes('pes2ug23cs', 1, 650, 'pesu_ecc_cs_2023')
add_pes('pes1ug23ec', 1, 450, 'pesu_ec_2023')
add_pes('pes2ug23ec', 1, 350, 'pesu_ecc_ec_2023')
add_pes('pes1ug23am', 1, 250, 'pesu_am_2023')
add_pes('pes2ug23am', 1, 200, 'pesu_ecc_am_2023')
add_pes('pes1ug23ee', 1, 180, 'pesu_ee_2023')
add_pes('pes1ug23me', 1, 180, 'pesu_me_2023')
add_pes('pes1ug23bt', 1, 100, 'pesu_bt_2023')
add_pes('pes2ug22cs', 1, 700, 'pesu_ecc_cs_2022')
add_pes('pes2ug22ec', 1, 350, 'pesu_ecc_ec_2022')
add_pes('pes1ug22cs', 800, 920, 'pesu_cs_2022')
add_pes('pes2ug22am', 1, 200, 'pesu_ecc_am_2022')
add_pes('pes1ug20cs', 1, 600, 'pesu_cs_2020')
add_pes('pes2ug20cs', 1, 400, 'pesu_ecc_cs_2020')
add_pes('pes1pg23ca', 1, 150, 'pesu_mca_2023')
add_pes('pes1pg23cs', 1, 120, 'pesu_mtech_2023')

# 2. Bennett University (Blackboard LMS)
# Schema: e<yy><branch>u<roll>@bennett.edu.in
def add_bennett(prefix, start, end, src):
    for i in range(start, end + 1):
        add_contact('there', f"{prefix}{i:04d}@bennett.edu.in", src)

add_bennett('e23cseu', 1, 1600, 'bennett_cs_2023')
add_bennett('e23eceu', 1, 350, 'bennett_ec_2023')
add_bennett('e23aimlu', 1, 400, 'bennett_aiml_2023')
add_bennett('e23bteu', 1, 300, 'bennett_bt_2023')
add_bennett('e22cseu', 1, 1600, 'bennett_cs_2022')
add_bennett('e22eceu', 1, 350, 'bennett_ec_2022')
add_bennett('e22aimlu', 1, 400, 'bennett_aiml_2022')
add_bennett('e21cseu', 1, 1500, 'bennett_cs_2021')
add_bennett('e21eceu', 1, 300, 'bennett_ec_2021')

# 3. KIIT University (SAP / Moodle LMS)
# Schema: <year><branch><roll>@kiit.ac.in
def add_kiit(prefix, start, end, src):
    for i in range(start, end + 1):
        add_contact('there', f"{prefix}{i:03d}@kiit.ac.in", src)

add_kiit('2305', 1, 999, 'kiit_cs_2023')
add_kiit('2306', 1, 600, 'kiit_it_2023')
add_kiit('2307', 1, 500, 'kiit_csse_2023')
add_kiit('2308', 1, 500, 'kiit_csce_2023')
add_kiit('2304', 1, 600, 'kiit_etc_2023')
add_kiit('2205', 1, 999, 'kiit_cs_2022')
add_kiit('2206', 1, 600, 'kiit_it_2022')
add_kiit('2105', 1, 999, 'kiit_cs_2021')
add_kiit('2106', 1, 600, 'kiit_it_2021')

# 4. BITS Pilani (Nalanda Moodle LMS)
# Schema: f<year><roll>@<campus>.bits-pilani.ac.in
for yr in ['2023', '2022']:
    for i in range(1, 1601):
        add_contact('there', f"f{yr}{i:04d}@pilani.bits-pilani.ac.in", f'bits_pilani_{yr}')
    for i in range(1, 1301):
        add_contact('there', f"f{yr}{i:04d}@goa.bits-pilani.ac.in", f'bits_goa_{yr}')
    for i in range(1, 1501):
        add_contact('there', f"f{yr}{i:04d}@hyderabad.bits-pilani.ac.in", f'bits_hyd_{yr}')

# 5. SRM Institute of Science & Technology (Google Workspace)
# Schema: <initials><4digits>@srmist.edu.in
srm_initial_pairs = [
    'ab', 'ad', 'ak', 'am', 'an', 'ap', 'ar', 'as', 'av', 'ds', 'hk', 'kp', 'mk', 'mp', 'ms',
    'nk', 'ns', 'om', 'pk', 'ps', 'ra', 'rk', 'rs', 'sa', 'sb', 'sd', 'sk', 'sm', 'sn', 'sp',
    'sr', 'ss', 'sv', 'tk', 'va', 'vk', 'vs'
]
for p in srm_initial_pairs:
    for num in range(1001, 1401):
        add_contact('there', f"{p}{num}@srmist.edu.in", 'srmist_verified_format')

# 6. MAHE / MIT Manipal (Microsoft 365)
# Schema: <firstname>.<lastname>@learner.manipal.edu
common_firstnames = [
    'aarav', 'aditya', 'akash', 'alok', 'aman', 'amit', 'ananya', 'aniket', 'anish', 'ankit',
    'anshul', 'arpit', 'ashish', 'atharv', 'ayush', 'bhavya', 'chaitanya', 'chirag', 'deepak', 'dev',
    'dhruv', 'divya', 'gaurav', 'harsh', 'ishaan', 'kartik', 'kunal', 'manish', 'mayank', 'mohit',
    'nakul', 'naman', 'nikhil', 'nishant', 'parth', 'piyush', 'pranav', 'prateek', 'rahul', 'rajat',
    'rishabh', 'rohit', 'sachin', 'sahil', 'samarth', 'sarthak', 'saurabh', 'shivam', 'shreyas', 'shubham',
    'siddharth', 'soham', 'tanmay', 'tarun', 'tejas', 'utkarsh', 'vaibhav', 'varun', 'vedant', 'yash'
]
common_surnames = [
    'agarwal', 'bansal', 'bhat', 'chaudhary', 'chawla', 'das', 'deshmukh', 'dutta', 'garg', 'ghosh',
    'gupta', 'iyer', 'jain', 'jha', 'joshi', 'kamath', 'kapoor', 'kaur', 'khatri', 'kulkarni',
    'kumar', 'mahajan', 'malhotra', 'mehta', 'mishra', 'mittal', 'mukherjee', 'nair', 'pandey', 'patel',
    'patil', 'prasad', 'rai', 'raj', 'rao', 'reddy', 'roy', 'saxena', 'sen', 'shah',
    'sharma', 'shukla', 'singh', 'sinha', 'srivastava', 'tiwari', 'tripathi', 'varma', 'verma', 'yadav'
]

for fn in common_firstnames:
    for sn in common_surnames:
        add_contact(f"{fn.capitalize()} {sn.capitalize()}", f"{fn}.{sn}@learner.manipal.edu", 'manipal_student')

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

print(f"Added {len(new_contacts)} new student contacts.")
print(f"Total Unique Contacts in Reserve: {len(unique_contacts)}")
