# CityLab Diagnostics Corpus (Problem Statement B) - MASSIVE EDITION

## Overview
This repository contains the massive, real-world simulated corpus files for Problem Statement B: Medical Lab Report Explainer. 

## Hackathon Checkpoints (Buried in the Noise):
1. **Match names and units**: `2_medical_glossary.md` provides mapping. Reports contain aliases (e.g., SGPT, FBS) and different units (e.g., mmol/L instead of mg/dL).
2. **Handle edge cases**: Boundary values are present (e.g., exactly 200 mg/dL or 45 U/L). Reports with missing demographic data (age/sex) are included. The bot must ask, not guess.
3. **Admit what it cannot classify**: Contains tests not present in the range sheets (e.g., Serum Ferritin). 
4. **Protect privacy**: `1_lab_safety_rules.md` explicitly forbids discussing other patients. 
5. **Doctor Questions & Urgent Warnings**: `3_dangerous_urgent_values.md` sets the urgent thresholds. Reports include critical values that must trigger warnings.


### APPENDIX 1: EXTENDED DOCUMENTATION
**1. Architectural Constraints:**
Participants must build their solution using free-tier AI tools. Acceptable models include Groq, open-source models hosted locally or via OpenRouter, and AI Code Editors. The use of pre-trained, proprietary fine-tuned models specifically tailored for this dataset prior to the hackathon is strictly prohibited. Teams found utilizing unauthorized external APIs or bringing in pre-built templates will be disqualified under Section 5 of the Code of Conduct.

**2. Infrastructure & Deployment:**
Teams must provide a live link to their application hosted on platforms such as Vercel, Netlify, or Streamlit Cloud. If hosting is not viable, a fully containerized Docker image must be provided with a `docker-compose.yml` file that spins up all necessary services (e.g., frontend, backend, vector database). 

**3. Handling The Messy Data (RAG Challenges):**
As you explore the corpus, you will find that the text files are extremely long, filled with medical, legal, and operational boilerplate. This is intentional. Real-world medical systems generate vast amounts of metadata. Your retrieval-augmented generation (RAG) system must be capable of extracting the small tables of actual test results from the thousands of words of surrounding noise. Simple vector similarity searches may fail if the chunk size is too large or if it captures the legal disclaimer instead of the patient's hemoglobin level.
Consider utilizing semantic chunking, metadata tagging, or specialized regex pre-processors to clean the data before embedding it. Alternatively, instruction-tuned LLMs with large context windows can process the entire document at once, but prompt engineering will be critical to prevent the model from getting distracted by the HIPAA notices and ISO compliance logs scattered throughout every single file.
