# Mwananchi Budget Concierge 🇰🇪

**Empowering Kenyan citizens with real-time, AI-driven transparency into local county budgets.**

## 🌟 The Problem
Most Kenyans know their taxes go to the government, but very few know exactly how that money is spent in their own backyard. Official budget documents are typically 200+ page PDFs filled with technical jargon, hidden in obscure government portals. This information gap leads to a lack of accountability and low civic engagement.

**Mwananchi Budget Concierge** solves this by turning complex budget data into a simple, conversational assistant. Residents can select their county and ward to see exactly what projects are funded—from road repairs to health clinics—and ask follow-up questions in natural language.

---

## 🤖 Agent Architecture

The application uses a **Full-Stack Agentic Workflow** powered by Google Gemini and Firebase.

### 1. The Concierge Agent (Resident-Facing)
*   **Role**: A friendly, Swahili/Sheng-speaking assistant that grounds its knowledge in specific budget data.
*   **Tools**: 
    *   **Context Grounding**: Dynamically pulls budget summaries for the selected county/ward from Firestore.
    *   **Translation/Simplification**: Converts technical financial terms (e.g., "Non-performing assets") into simple concepts for the user.

### 2. The Discovery Agent (Admin-Facing)
*   **Role**: Automates the ingestion of public budget data.
*   **Tools**:
    *   **Web Discovery**: Uses Gemini to search for and identify official budget PDF URLs across 47 county websites.
    *   **Structure Extraction**: Analyzes discovered URLs to extract total allocations, project lists, and administrative ward names.
    *   **Auto-Seeding**: Writes parsed data directly to Firestore, keeping the system up-to-date without manual data entry.

### 3. Communication Bridge
*   **SMS Broadcast Tool**: Integrates with the **Africa's Talking API** to send real-time alerts to residents when new budget amendments are passed in their specific ward.

---

## 🚀 How to Run Locally

### Prerequisites
*   Node.js (v18+)
*   Firebase Project (Firestore & Auth enabled)
*   Gemini API Key (Google AI Studio)

### Setup
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/mwananchi-budget-concierge.git
    cd mwananchi-budget-concierge
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Create a `.env` file in the root:
    ```env
    GEMINI_API_KEY=your_gemini_key_here
    AFRICAS_TALKING_USERNAME=sandbox
    AFRICAS_TALKING_API_KEY=your_at_key_here
    ```

4.  **Firebase Config**
    Download your `firebase-applet-config.json` from the Firebase console and place it in the root directory.

5.  **Start Development Server**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:3000`

---

## 🌐 Interacting with the Deployed Version

1.  **Select Your Location**: Use the dropdowns to pick your **County** (e.g., Nairobi, Kiambu) and **Ward** (e.g., Roysambu).
2.  **Explore the Dashboard**: View the instant breakdown of Development vs. Recurrent spending.
3.  **Chat with the Concierge**: Ask questions like:
    *   "How much is allocated for health in my ward?"
    *   "What are the top 3 projects being funded this year?"
    *   "Explain what 'Recurrent Budget' means in simple terms."
4.  **Admin Mode**: (Restricted access) Experience the AI-powered search by entering a county name and clicking "AI Auto-Discover".

---

## 📸 Screenshots & Demo
*   
*   <img width="1366" height="768" alt="Screenshot (622)" src="https://github.com/user-attachments/assets/68379df9-380c-4b2e-b301-b7bea2f904b9" />
<img width="1366" height="768" alt="Screenshot (621)" src="https://github.com/user-attachments/assets/eb269567-e954-41be-aa4d-d2ee7b43dc24" />
<img width="1366" height="768" alt="Screenshot (620)" src="https://github.com/user-attachments/assets/6172626c-7271-4786-98ca-2bca26e13e15" />


---

## 👥 Meet the Team
*   **Collins Njuguna**: - Front-end Design
*   **Lewis Mwangi**: - front end and firebase structure
*   **Victor Mwangi**: - Backend and AI
*   **Franklin Muchiri**: - Data Analyst
*   **Allan Bill Otiende**: - Webhook Engine
*   **Asahel Kigen**: - Core Data Architecture

---

## 📜 License
This project is licensed under the MIT License.
