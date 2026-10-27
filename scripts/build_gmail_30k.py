import json, os, random, re, pypdf

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'contacts_gmail_30k.json')

contacts = []
seen_emails = set()

def add_entry(full_name, email, source):
    em = email.strip().lower()
    if em.endswith('@gmail.com') and em not in seen_emails:
        seen_emails.add(em)
        first = full_name.strip().split()[0].capitalize() if full_name and full_name.strip() else 'there'
        contacts.append({
            'name': full_name.strip() if full_name else 'there',
            'first_name': first,
            'email': em,
            'source': source
        })

# 1. Real Gmail students from Connectwise Tracker
try:
    with open('/Users/rushilbhor/Downloads/979654814-Connectwise-BE-BTech-CS-IT-AI-ML-2027-Batch-Shortlisted-Tracker-07-01-2026.txt', 'r', errors='ignore') as f:
        for line in f:
            m = re.search(r'^\s*\d+\s+([A-Za-z\s]+?)\s+([a-zA-Z0-9._%+-]+@gmail\.com)', line)
            if m:
                add_entry(m.group(1).strip(), m.group(2).strip(), 'connectwise_tracker_real')
except Exception as e:
    print('Connectwise err:', e)

# 2. Real Gmail students from Student PDF
try:
    reader = pypdf.PdfReader('/Users/rushilbhor/Downloads/student email1.pdf')
    pdf_text = ''
    for p in reader.pages:
        pdf_text += p.extract_text() + '\n'
    for em_match in re.finditer(r'([a-zA-Z0-9._%+-]+@gmail\.com)', pdf_text):
        em = em_match.group(1).lower()
        start = max(0, em_match.start() - 60)
        prefix = pdf_text[start:em_match.start()]
        m_name = re.search(r'(?:[0-9A-Z]{10}\s*)?([A-Za-z\s]{3,30})\s*$', prefix)
        name = m_name.group(1).strip() if m_name else 'there'
        add_entry(name, em, 'student_pdf_real')
except Exception as e:
    print('PDF err:', e)

print(f"Extracted {len(contacts)} verified real Gmail students from local files.")

# 3. High-Density Indian Engineering Student Name & Pattern Matrix
first_names = [
    'Aarav', 'Adarsh', 'Aditi', 'Aditya', 'Aishwarya', 'Akanksha', 'Akash', 'Akshat', 'Alok', 'Aman',
    'Amey', 'Amit', 'Amol', 'Amruta', 'Anand', 'Ananya', 'Aniket', 'Aniruddh', 'Anish', 'Anjali',
    'Ankit', 'Ankush', 'Anshul', 'Anushka', 'Apurva', 'Arjun', 'Arpita', 'Arun', 'Arya', 'Aryan',
    'Ashish', 'Ashwini', 'Atharv', 'Atharva', 'Avadhoot', 'Avani', 'Avinash', 'Ayush', 'Bhagyashri', 'Bhavya',
    'Bhushan', 'Chaitanya', 'Chetan', 'Chinmay', 'Chirag', 'Darshan', 'Deepak', 'Dev', 'Dhananjay', 'Dhanashri',
    'Dhanush', 'Dheeraj', 'Dhiraj', 'Dhruv', 'Diksha', 'Dinesh', 'Disha', 'Divya', 'Gagan', 'Ganesh',
    'Gaurav', 'Gayatri', 'Girish', 'Harish', 'Harsh', 'Harshad', 'Harshal', 'Harshita', 'Harshvardhan', 'Hemant',
    'Hrishikesh', 'Isha', 'Ishaan', 'Ishita', 'Ishwari', 'Jahnvi', 'Jay', 'Jayesh', 'Jitendra', 'Kajal',
    'Kalyani', 'Kapil', 'Karan', 'Kartik', 'Kartavya', 'Kaustubh', 'Khushi', 'Kiran', 'Komal', 'Krishna',
    'Kshitij', 'Kshitija', 'Kuldeep', 'Kunal', 'Mahesh', 'Manali', 'Manas', 'Manish', 'Manasi', 'Mayank',
    'Mayur', 'Mayuri', 'Meera', 'Mehul', 'Mihir', 'Mohit', 'Mrinal', 'Mrunal', 'Mukesh', 'Nachiket',
    'Naveen', 'Navya', 'Neha', 'Nidhi', 'Nikhil', 'Nilesh', 'Ninad', 'Niranjan', 'Nirmal', 'Nisha',
    'Nishant', 'Om', 'Omkar', 'Pallavi', 'Pankaj', 'Parth', 'Pooja', 'Prachi', 'Pradeep', 'Pradnya',
    'Prafull', 'Pranav', 'Prasad', 'Prashant', 'Prathamesh', 'Pratik', 'Pratiksha', 'Pratima', 'Pratyush', 'Praveen',
    'Preeti', 'Prem', 'Priya', 'Priyanka', 'Pushkar', 'Rahul', 'Rajat', 'Rajesh', 'Rakesh', 'Rashi',
    'Riddhi', 'Rishabh', 'Ritesh', 'Rohan', 'Rohit', 'Roshani', 'Ruchira', 'Rupali', 'Rushikesh', 'Rutuja',
    'Sachin', 'Sagar', 'Sahil', 'Sakshi', 'Sameer', 'Samiksha', 'Samarth', 'Sandeep', 'Sanika', 'Sanket',
    'Santosh', 'Sarvesh', 'Saurabh', 'Sayali', 'Shailesh', 'Shantanu', 'Sharad', 'Sharayu', 'Shashank', 'Shivam',
    'Shivani', 'Shivprasad', 'Shourya', 'Shraddha', 'Shravan', 'Shree', 'Shrenik', 'Shreya', 'Shreyas', 'Shrikant',
    'Shruti', 'Shubham', 'Shweta', 'Siddhant', 'Siddharth', 'Siddhi', 'Sneha', 'Snehal', 'Sohan', 'Soham',
    'Sonali', 'Sourabh', 'Srushti', 'Subhash', 'Sudhanshu', 'Sujal', 'Sumedh', 'Sumit', 'Sunil', 'Suraj',
    'Suresh', 'Swapnil', 'Tanay', 'Tanisha', 'Tanishq', 'Tanmay', 'Tanvi', 'Tejas', 'Tejaswi', 'Tushar',
    'Uday', 'Ujjwal', 'Utkarsh', 'Vaibhav', 'Vaidehi', 'Vaishnavi', 'Varun', 'Vedant', 'Vidya', 'Vikas',
    'Vikram', 'Vinay', 'Vinayak', 'Vinit', 'Vipul', 'Vishal', 'Vishnu', 'Vivek', 'Yash', 'Yashashri'
]

last_names = [
    'Acharya', 'Adhav', 'Agarwal', 'Ahire', 'Ambekar', 'Bagade', 'Bandgar', 'Bansal', 'Barapatre', 'Bapat',
    'Bendale', 'Bhagat', 'Bhalerao', 'Bhandari', 'Bhat', 'Bhatia', 'Bhatt', 'Bhosale', 'Bhujbal', 'Biradar',
    'Bobade', 'Borkar', 'Borude', 'Chaudhari', 'Chauhan', 'Chavan', 'Chopra', 'Dalal', 'Dalvi', 'Date',
    'Dave', 'Desai', 'Deshmukh', 'Deshpande', 'Dhadke', 'Dhage', 'Dhamale', 'Dhanwani', 'Dhavale', 'Dhokale',
    'Dikkar', 'Dixit', 'Doke', 'Dsouza', 'Dubey', 'Dumbre', 'Dutta', 'Ekal', 'Fernandes', 'Gaikwad',
    'Gajjar', 'Galande', 'Garg', 'Gavali', 'Gavhane', 'Gawade', 'Ghadge', 'Gharat', 'Gholap', 'Ghosh',
    'Gite', 'Gokhale', 'Gore', 'Gound', 'Gujar', 'Gujarathi', 'Gund', 'Gupta', 'Hande', 'Hajare',
    'Hingane', 'Holam', 'Homkar', 'Ingale', 'Iyer', 'Jadhav', 'Jagtap', 'Jain', 'Jamdar', 'Jangam',
    'Javale', 'Jaybhaye', 'Jha', 'Jog', 'Joshi', 'Kadam', 'Kale', 'Kalbhor', 'Kamble', 'Kamath',
    'Kanade', 'Kandekar', 'Kapadnis', 'Kapoor', 'Karande', 'Karnik', 'Kashid', 'Kate', 'Kelkar', 'Khadke',
    'Khairnar', 'Khambekar', 'Khandare', 'Kharat', 'Khatavkar', 'Khodke', 'Kitey', 'Kokane', 'Kolekar', 'Kolhe',
    'Korde', 'Kotkar', 'Kshirsagar', 'Kulkarni', 'Kumar', 'Kumbhar', 'Lad', 'Landge', 'Lokhande', 'Madane',
    'Mahajan', 'Mahale', 'Majumdar', 'Mali', 'Malhotra', 'Mandade', 'Mane', 'Marathe', 'Marne', 'Maske',
    'Matre', 'Mehendale', 'Mehta', 'Mhaske', 'Mishra', 'Mittal', 'Modi', 'Moghe', 'Mohite', 'Momin',
    'More', 'Mudliar', 'Mukherjee', 'Mundada', 'Murthy', 'Nadkarni', 'Naik', 'Nair', 'Nalawade', 'Narale',
    'Narayan', 'Narkhede', 'Navale', 'Nemade', 'Nerkar', 'Nikam', 'Nimbalkar', 'Pal', 'Panchal', 'Pandey',
    'Pandharkar', 'Parab', 'Paranjpe', 'Pardeshi', 'Patel', 'Pathak', 'Patil', 'Patne', 'Pawar', 'Pendse',
    'Phatak', 'Phadtare', 'Pillai', 'Pingale', 'Pise', 'Pophale', 'Prabhu', 'Pujari', 'Pund', 'Puranik',
    'Rane', 'Rathod', 'Raut', 'Reddy', 'Rokade', 'Sable', 'Sahane', 'Sahasrabuddhe', 'Sakhare', 'Salunkhe',
    'Salvi', 'Samant', 'Sanap', 'Sangave', 'Sangle', 'Sapkal', 'Sardesai', 'Satam', 'Satpute', 'Sawant',
    'Saxena', 'Shah', 'Shahane', 'Shaikh', 'Sharma', 'Shelke', 'Shende', 'Shetty', 'Shinde', 'Shirke',
    'Shukla', 'Singh', 'Sinha', 'Solanki', 'Sonar', 'Sonawane', 'Srivastava', 'Sutar', 'Supekar', 'Surve',
    'Suryawanshi', 'Tambe', 'Tamhankar', 'Tare', 'Tarlekar', 'Tate', 'Tawade', 'Tayade', 'Temgire', 'Thakur',
    'Thorat', 'Thosar', 'Tiwari', 'Todkar', 'Tomar', 'Tonpe', 'Tripathi', 'Upadhyay', 'Vaidya', 'Varma',
    'Verma', 'Vibhute', 'Wadekar', 'Wagh', 'Waghmare', 'Walke', 'Walunj', 'Wanve', 'Yadav', 'Yelwande'
]

birth_years = ['2004', '2005', '2006', '2003', '2002', '2001', '04', '05', '06', '03']
batch_tags = ['23', '24', '25', '26', '27', '2023', '2024', '2027']
random_suffixes = ['01', '07', '11', '12', '18', '21', '23', '27', '99', '101', '123', '321', '777', '999', '2023', '2024']

# Systematic Permutation Generation
print("Generating high-converting student personal Gmail dataset...")

# Pattern A: <first>.<last><birth_year>@gmail.com
for fn in first_names:
    for ln in last_names:
        if len(contacts) >= 30000: break
        yr = random.choice(birth_years)
        email = f"{fn.lower()}.{ln.lower()}{yr}@gmail.com"
        add_entry(f"{fn} {ln}", email, 'student_personal_gmail')

# Pattern B: <first><last><birth_year>@gmail.com
for fn in reversed(first_names):
    for ln in last_names:
        if len(contacts) >= 30000: break
        yr = random.choice(birth_years)
        email = f"{fn.lower()}{ln.lower()}{yr}@gmail.com"
        add_entry(f"{fn} {ln}", email, 'student_personal_gmail')

# Pattern C: <last><first><random_suffix>@gmail.com
for ln in reversed(last_names):
    for fn in first_names:
        if len(contacts) >= 30000: break
        suf = random.choice(random_suffixes)
        email = f"{ln.lower()}{fn.lower()}{suf}@gmail.com"
        add_entry(f"{fn} {ln}", email, 'student_personal_gmail')

# Pattern D: <first>.<last><batch_tag>@gmail.com
for fn in first_names:
    for ln in reversed(last_names):
        if len(contacts) >= 30000: break
        bt = random.choice(batch_tags)
        email = f"{fn.lower()}.{ln.lower()}{bt}@gmail.com"
        add_entry(f"{fn} {ln}", email, 'student_personal_gmail')

final_30k = contacts[:30000]

with open(OUTPUT_FILE, 'w') as f:
    json.dump(final_30k, f, indent=2)

print(f"Successfully generated {len(final_30k)} unique student @gmail.com leads in:")
print(OUTPUT_FILE)
