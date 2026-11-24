"""Fixed Diagnostic Placement Questions (Class 10th Curriculum Standard).
Balanced across 5 foundational subjects:
- Science (Biology, Physics/Chemistry)
- Mathematics (Percentages, Geometry)
- English (Grammar, Vocabulary)
- Basic Reasoning (Number Series, Analogies)
- Hindi (पर्यायवाची / Synonyms, विलोम / Antonyms)

All students receive this identical, calm 10-question assessment upon registration
to ensure predictable, instant placement without LLM generation latency.
"""
from typing import List, Dict, Any

FIXED_DIAGNOSTIC_QUESTIONS: List[Dict[str, Any]] = [
    # 1. Science (Biology / Life Science)
    {
        "prompt": "What gas do green plants absorb from the atmosphere during photosynthesis?",
        "question_type": "mcq",
        "subject": "Science",
        "options": [
            {"key": "A", "text": "Oxygen"},
            {"key": "B", "text": "Carbon Dioxide"},
            {"key": "C", "text": "Nitrogen"},
            {"key": "D", "text": "Hydrogen"},
        ],
        "correct_answer": {"key": "B", "text": "Carbon Dioxide"},
        "explanation": "Green plants absorb Carbon Dioxide (CO2) from the air and release Oxygen using sunlight and chlorophyll during photosynthesis.",
        "difficulty": "easy",
    },
    # 2. Science (Physics & Chemistry)
    {
        "prompt": "Which state of matter has a definite volume but takes the shape of its container?",
        "question_type": "mcq",
        "subject": "Science",
        "options": [
            {"key": "A", "text": "Solid"},
            {"key": "B", "text": "Liquid"},
            {"key": "C", "text": "Gas"},
            {"key": "D", "text": "Plasma"},
        ],
        "correct_answer": {"key": "B", "text": "Liquid"},
        "explanation": "Liquids have a definite volume because their particles stay close together, but they take the shape of the container because particles can flow past each other.",
        "difficulty": "easy",
    },
    # 3. Mathematics (Arithmetic & Percentages)
    {
        "prompt": "A shirt originally priced at ₹600 is sold with a 25% discount. What is its sale price?",
        "question_type": "mcq",
        "subject": "Mathematics",
        "options": [
            {"key": "A", "text": "₹450"},
            {"key": "B", "text": "₹480"},
            {"key": "C", "text": "₹500"},
            {"key": "D", "text": "₹520"},
        ],
        "correct_answer": {"key": "A", "text": "₹450"},
        "explanation": "25% discount on ₹600 = (25 / 100) × 600 = ₹150. Sale price = 600 - 150 = ₹450.",
        "difficulty": "medium",
    },
    # 4. Mathematics (Geometry & Mensuration)
    {
        "prompt": "What is the perimeter of a rectangle with a length of 14 cm and a width of 6 cm?",
        "question_type": "mcq",
        "subject": "Mathematics",
        "options": [
            {"key": "A", "text": "84 cm"},
            {"key": "B", "text": "40 cm"},
            {"key": "C", "text": "20 cm"},
            {"key": "D", "text": "28 cm"},
        ],
        "correct_answer": {"key": "B", "text": "40 cm"},
        "explanation": "Perimeter of a rectangle = 2 × (length + width) = 2 × (14 + 6) = 2 × 20 = 40 cm.",
        "difficulty": "easy",
    },
    # 5. English (Grammar & Syntax)
    {
        "prompt": "Select the sentence that uses correct subject-verb agreement:",
        "question_type": "mcq",
        "subject": "English",
        "options": [
            {"key": "A", "text": "The team of students are practicing every afternoon."},
            {"key": "B", "text": "The team of students is practicing every afternoon."},
            {"key": "C", "text": "The team of students were practicing tomorrow."},
            {"key": "D", "text": "The team of students have practicing well."},
        ],
        "correct_answer": {"key": "B", "text": "The team of students is practicing every afternoon."},
        "explanation": "'Team' is a collective singular noun acting as the subject, which correctly takes the singular verb 'is'.",
        "difficulty": "medium",
    },
    # 6. English (Vocabulary & Synonyms)
    {
        "prompt": "What is the synonym of the word 'ABUNDANT'?",
        "question_type": "mcq",
        "subject": "English",
        "options": [
            {"key": "A", "text": "Plentiful (existing in large amounts)"},
            {"key": "B", "text": "Scarce (hard to find)"},
            {"key": "C", "text": "Fragile (easily broken)"},
            {"key": "D", "text": "Complicated (difficult to understand)"},
        ],
        "correct_answer": {"key": "A", "text": "Plentiful (existing in large amounts)"},
        "explanation": "'Abundant' means existing or available in large quantities; plentiful.",
        "difficulty": "easy",
    },
    # 7. Basic Reasoning (Number Series)
    {
        "prompt": "Find the next number in the pattern: 2, 6, 12, 20, 30, ___?",
        "question_type": "mcq",
        "subject": "Basic Reasoning",
        "options": [
            {"key": "A", "text": "36"},
            {"key": "B", "text": "40"},
            {"key": "C", "text": "42"},
            {"key": "D", "text": "48"},
        ],
        "correct_answer": {"key": "C", "text": "42"},
        "explanation": "The differences between consecutive numbers increase by 2: +4, +6, +8, +10. Next difference is +12, so 30 + 12 = 42.",
        "difficulty": "medium",
    },
    # 8. Basic Reasoning (Analogy)
    {
        "prompt": "Complete the analogy: Book is to Reading as Fork is to:",
        "question_type": "mcq",
        "subject": "Basic Reasoning",
        "options": [
            {"key": "A", "text": "Writing"},
            {"key": "B", "text": "Eating"},
            {"key": "C", "text": "Cooking"},
            {"key": "D", "text": "Washing"},
        ],
        "correct_answer": {"key": "B", "text": "Eating"},
        "explanation": "A book is an instrument used for reading; a fork is an instrument used for eating.",
        "difficulty": "easy",
    },
    # 9. Hindi (पर्यायवाची शब्द / Synonyms)
    {
        "prompt": "निम्नलिखित में से 'सूर्य' (Sun) का सही पर्यायवाची शब्द कौन सा है?",
        "question_type": "mcq",
        "subject": "Hindi",
        "options": [
            {"key": "A", "text": "भास्कर"},
            {"key": "B", "text": "शशांक"},
            {"key": "C", "text": "जलद"},
            {"key": "D", "text": "पवन"},
        ],
        "correct_answer": {"key": "A", "text": "भास्कर"},
        "explanation": "'भास्कर' और 'दिनकर' सूर्य के मुख्य पर्यायवाची शब्द हैं (शशांक चंद्रमा का, जलद बादल का, और पवन वायु का नाम है)।",
        "difficulty": "easy",
    },
    # 10. Hindi (विलोम शब्द / Antonyms)
    {
        "prompt": "'सत्य' (Truth) शब्द का सही विलोम (Opposite) शब्द कौन सा है?",
        "question_type": "mcq",
        "subject": "Hindi",
        "options": [
            {"key": "A", "text": "असत्य"},
            {"key": "B", "text": "कपट"},
            {"key": "C", "text": "अधर्म"},
            {"key": "D", "text": "क्रोध"},
        ],
        "correct_answer": {"key": "A", "text": "असत्य"},
        "explanation": "'सत्य' का सही और सीधा विलोम शब्द 'असत्य' (Untruth) होता है।",
        "difficulty": "easy",
    },
]
