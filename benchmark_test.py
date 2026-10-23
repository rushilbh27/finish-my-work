import json
import time
import urllib.request
import re

TEST_QUESTIONS = [
    {
        "id": 1,
        "subject": "Geography / Alpine History",
        "question": "Who was the first person to reach the top of Mont Blanc?",
        "options": ["Jacques Balmat", "Edmund Hilary", "Edward Whymper", "George Mallory"],
        "correct_letter": "A"
    },
    {
        "id": 2,
        "subject": "Earth Science / Glaciology",
        "question": "The Mer de Glace glacier in the French Alps has significantly receded over the past century due to climate change. True or False?",
        "options": ["True", "False"],
        "correct_letter": "A"
    },
    {
        "id": 3,
        "subject": "Biology / Genetics",
        "question": "Which of the following nitrogenous bases is found in RNA but NOT in DNA?",
        "options": ["Thymine", "Uracil", "Guanine", "Cytosine"],
        "correct_letter": "B"
    },
    {
        "id": 4,
        "subject": "Physics / Mechanics",
        "question": "What is the SI unit of force?",
        "options": ["Joule", "Pascal", "Newton", "Watt"],
        "correct_letter": "C"
    },
    {
        "id": 5,
        "subject": "Chemistry / Periodic Table",
        "question": "What is the chemical symbol for Gold?",
        "options": ["Ag", "Fe", "Au", "Pb"],
        "correct_letter": "C"
    },
    {
        "id": 6,
        "subject": "Computer Science / Algorithms",
        "question": "What is the average time complexity of searching for an element in a balanced Binary Search Tree (BST)?",
        "options": ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
        "correct_letter": "C"
    },
    {
        "id": 7,
        "subject": "World History",
        "question": "In which year did the Apollo 11 mission successfully land the first humans on the Moon?",
        "options": ["1965", "1969", "1972", "1975"],
        "correct_letter": "B"
    },
    {
        "id": 8,
        "subject": "Alpine Safety / Health",
        "question": "What primary piece of protective gear is essential to prevent photokeratitis (snow blindness) when mountaineering on snow and ice?",
        "options": ["Sunglasses or Glacier Goggles", "Earplugs", "Knee pads", "Reflective vest"],
        "correct_letter": "A"
    }
]

def solve_with_pollinations(question_text, options):
    formatted_options = "\n".join([f"{chr(65+i)}. {opt}" for i, opt in enumerate(options)])
    max_letter = chr(65 + len(options) - 1)
    prompt = f"Question: {question_text}\n\nOptions:\n{formatted_options}\n\nTask: Output ONLY the single correct option letter (from A to {max_letter}). Do not add explanations."
    
    url = "https://text.pollinations.ai/"
    payload = json.dumps({
        "messages": [
            {"role": "system", "content": "You are an expert exam solver. Output ONLY the single option letter."},
            {"role": "user", "content": prompt}
        ],
        "model": "openai-fast",
        "seed": 42,
        "private": True,
        "temperature": 0.1
    }).encode("utf-8")
    
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            text = resp.read().decode("utf-8").strip()
            
            # Check for rate limit
            if "Free limit reached" in text or "Please wait" in text:
                match = re.search(r"Please wait (\d+)", text)
                wait_sec = int(match.group(1)) if match else 28
                return {"success": False, "rate_limited": True, "wait_sec": wait_sec, "raw": text}
            
            # Extract letter
            match = re.search(rf"\b([A-{max_letter}])\b", text, re.IGNORECASE)
            if match:
                return {"success": True, "letter": match.group(1).upper(), "raw": text}
            
            return {"success": False, "error": "No letter match", "raw": text}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        if e.code == 429 or "Please wait" in err_body or "Free limit reached" in err_body:
            match = re.search(r"Please wait (\d+)", err_body)
            wait_sec = int(match.group(1)) if match else 28
            return {"success": False, "rate_limited": True, "wait_sec": wait_sec, "raw": err_body}
        return {"success": False, "error": f"HTTP {e.code}: {err_body[:80]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def run_benchmark():
    print("=" * 65)
    print("AUTOPILOT AI — DEFAULT FREE AI ACCURACY & COOLDOWN BENCHMARK")
    print("=" * 65)
    
    results = []
    correct_count = 0
    total_time = 0
    
    for i, q in enumerate(TEST_QUESTIONS):
        print(f"\n[Q{q['id']}] {q['subject']}")
        print(f"Question: {q['question']}")
        for idx, opt in enumerate(q['options']):
            print(f"  {chr(65+idx)}. {opt}")
        print(f"Expected: {q['correct_letter']}")
        
        start_t = time.time()
        ans = None
        attempts = 0
        
        while attempts < 4:
            attempts += 1
            res = solve_with_pollinations(q['question'], q['options'])
            
            if res.get("success"):
                ans = res["letter"]
                break
            elif res.get("rate_limited"):
                wait_s = res.get("wait_sec", 28) + 1
                print(f"  ⏳ Free server cooldown: waiting {wait_s}s...")
                time.sleep(wait_s)
            else:
                print(f"  ⚠️ Error: {res.get('error')}. Waiting 3s...")
                time.sleep(3)
        
        elapsed = round(time.time() - start_t, 2)
        total_time += elapsed
        is_correct = (ans == q['correct_letter'])
        if is_correct:
            correct_count += 1
            
        status_sym = "✅ CORRECT" if is_correct else f"❌ WRONG (got {ans})"
        print(f"Result: {status_sym} (Time: {elapsed}s)")
        
        results.append({
            "id": q['id'],
            "subject": q['subject'],
            "expected": q['correct_letter'],
            "given": ans,
            "correct": is_correct,
            "time_sec": elapsed
        })
        
    print("\n" + "=" * 65)
    print("BENCHMARK SUMMARY")
    print("=" * 65)
    print(f"Total Questions: {len(TEST_QUESTIONS)}")
    print(f"Correct Answers: {correct_count} / {len(TEST_QUESTIONS)} ({correct_count/len(TEST_QUESTIONS)*100:.1f}%)")
    print(f"Total Time Taken: {round(total_time, 1)}s")
    
    with open("/Users/rushilbhor/Dev/peslms-autopilot/benchmark_results.json", "w") as f:
        json.dump({"accuracy": correct_count/len(TEST_QUESTIONS), "details": results}, f, indent=2)

if __name__ == "__main__":
    run_benchmark()
