# Final Project Report: Tereka - Personal Finance Manager

## 1. Cover Page
**Project Title:** Tereka - Personal Finance Manager  
**Student:** Mukisa Emmanuel  
**Course:** [Insert Course Name]  
**Instructor:** [Insert Instructor Name]  
**Institution:** [Insert Institution Name]  
**Date:** 03 May 2026  

---

## 2. Acknowledgement
I would like to express my sincere gratitude to my instructor and institution for their guidance and support throughout this project. I also acknowledge the resources and open-source communities that provided valuable knowledge for completing this system.

---

## 3. Abstract
This project, "Tereka", develops a comprehensive personal finance manager using Python, Flask, and MySQL. It aims to help users effectively track their daily income and expenses, set monthly category budgets, and monitor their financial health through detailed reports. The system provides a secure, multi-user environment where individuals can register, authenticate, and manage their finances independently. With a user-friendly interface built with HTML, CSS, and Jinja2 templating, users can easily log transactions and visualize budget progress. The outcome is a robust, functional web application that simplifies personal financial tracking and promotes better spending habits.

---

## 4. Table of Contents
1. Cover Page
2. Acknowledgement
3. Abstract
4. Table of Contents
5. Introduction
6. Problem Statement
7. Objectives
8. Scope of the Project
9. System Design
10. Data Design
11. User Interface Design
12. Technology Stack
13. Implementation
14. Testing
15. Results & Output
16. Challenges Faced
17. Limitations
18. Future Enhancements
19. Conclusion
20. References
21. Appendix

---

## 5. Introduction
Managing personal finances manually using spreadsheets or notebooks can be tedious, error-prone, and lacks real-time insights. Tereka is a web-based personal finance management application designed to solve this problem by automating expense tracking and budget monitoring. The application allows users to securely log in, add transactions, and immediately see how their spending impacts their monthly budgets.

---

## 6. Problem Statement
Individuals often find it difficult to track their daily expenses efficiently and stay within their monthly budgets without a centralized, automated system. This leads to overspending, disorganized financial records, and a lack of clear visibility into personal financial health.

---

## 7. Objectives
- To securely store and manage user financial data (income and expenses).
- To allow users to define and monitor monthly spending limits (budgets) by category.
- To generate automated monthly financial reports and summaries.
- To provide an intuitive, responsive user interface for seamless interaction.

---

## 8. Scope of the Project
**In Scope:**
- User authentication (registration, login, logout).
- Logging income and expense transactions.
- Setting and tracking category-based monthly budgets.
- Generating monthly financial summaries and transaction history.

**Out of Scope:**
- Bank account API integration for automatic transaction syncing.
- Multi-currency support and currency conversion.
- Advanced predictive financial forecasting.

---

## 9. System Design
The system follows a Model-View-Controller (MVC) architectural pattern:
- **Model (Data Layer):** Managed by `database.py`, which handles all MySQL database interactions (CRUD operations for users, transactions, and budgets).
- **View (Presentation Layer):** Handled by Jinja2 templates in the `templates/` directory, structured with HTML and CSS.
- **Controller (Logic Layer):** `app.py` serves as the Flask application core, routing requests, validating input, and coordinating between the database and the views.
- **Reporting Module:** `reports.py` handles complex data aggregation for monthly summaries.

---

## 10. Data Design
The system uses a relational MySQL database schema with the following core tables:
- `users`: `id` (INT, PK), `username` (VARCHAR), `email` (VARCHAR, UNIQUE), `password` (VARCHAR, Hashed).
- `categories`: `id` (INT, PK), `name` (VARCHAR).
- `transactions`: `id` (INT, PK), `user_id` (INT, FK), `type` (ENUM 'income', 'expense'), `amount` (DECIMAL), `category` (VARCHAR), `description` (VARCHAR), `date` (DATE), `created_at` (TIMESTAMP).
- `budgets`: `id` (INT, PK), `user_id` (INT, FK), `category` (VARCHAR), `monthly_limit` (DECIMAL).

---

## 11. User Interface Design
The application features a clean, responsive layout with a navigation menu for quick access to key modules:
1. **Dashboard:** Overview of monthly income, expenses, net balance, and recent transactions.
2. **Add Transaction:** Form to input amount, type, category, date, and description.
3. **Transactions:** Tabular history of all logged transactions with monthly filtering.
4. **Budgets:** Interface to set limits and visual progress bars showing spent vs. limit.
5. **Report:** Detailed breakdown of spending by category and daily averages.

---

## 12. Technology Stack
- **Backend:** Python 3, Flask framework
- **Database:** MySQL, `mysql-connector-python`
- **Frontend:** HTML5, CSS3, Jinja2 Templating
- **Security:** `bcrypt` for password hashing, Flask session management

---

## 13. Implementation
The system is built using Flask's routing mechanism. Key implementation logic includes:
- **Authentication:** `register()` hashes passwords using bcrypt before saving to the DB. A custom `@login_required` decorator secures private routes.
- **Transaction Handling:** `add_transaction()` validates user input (ensuring positive amounts) before inserting into the MySQL database.
- **Budget Tracking:** The system calculates the spending percentage dynamically in the template (`budgets.html`) to render visual progress bars, highlighting over-budget categories in red if `spent > monthly_limit`.

---

## 14. Testing
- **Test Case 1 (Registration):** Input: Existing email. → Output: Error message "Email already registered." → Result: Pass.
- **Test Case 2 (Add Transaction):** Input: Amount = -50. → Output: Error message "Amount must be a positive number." → Result: Pass.
- **Test Case 3 (Authentication):** Input: Access `/dashboard` without logging in. → Output: Redirected to `/login` with flash message. → Result: Pass.
- **Test Case 4 (Budgets Routing):** Input: Resolve template syntax error `{%{ percentage }%}`. → Output: Page renders `200 OK` without Internal Server Error. → Result: Pass.

---

## 15. Results & Output
The application successfully allows users to register, log in, and manage their finances. The dashboard accurately reflects real-time changes when a new transaction is added. The budget progress bars update correctly, providing immediate visual feedback when spending limits are approached or exceeded. 

---

## 16. Challenges Faced
- **Challenge:** Encountered a `500 Internal Server Error` on the Budgets page due to incorrect Jinja2 template syntax.
- **Solution:** Debugged the Flask error trace and corrected the syntax to `{{ percentage }}%`, resolving the rendering issue.
- **Challenge:** Managing MySQL connections and preventing cursor leaks.
- **Solution:** Implemented `try-except-finally` blocks in `database.py` to ensure `cursor.close()` and `conn.close()` are always executed securely.

---

## 17. Limitations
- Password reset functionality via email is not currently implemented.
- Users cannot create custom transaction categories; they must rely on the globally pre-seeded `categories` table.
- No data export features (e.g., Export to CSV or PDF) are currently available.

---

## 18. Future Enhancements
- Integrate interactive charts (e.g., Chart.js) for visual spending analysis.
- Implement a data export feature (CSV/PDF) for the monthly reports.
- Add support for custom, user-defined categories.
- Introduce profile management and password recovery options.

---

## 19. Conclusion
The Tereka Personal Finance Manager project was successfully developed and deployed. It meets its primary objectives of providing users with a secure and efficient tool to track transactions, manage budgets, and generate financial reports. Building this system provided valuable hands-on experience in full-stack web development with Python, Flask, and relational database management.

---

## 20. References
- Flask Documentation: https://flask.palletsprojects.com/
- Python MySQL Connector Docs: https://dev.mysql.com/doc/connector-python/en/
- Jinja2 Template Designer Documentation: https://jinja.palletsprojects.com/

---

## 21. Appendix
Full source code is available in the GitHub repository at `https://github.com/mukisaemmanuel/tereka`. Key backend files driving the system logic include `app.py`, `database.py`, and `reports.py`.
