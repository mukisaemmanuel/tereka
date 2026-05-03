---
title: "Tereka – Automated Personal Finance Manager"
author: "Mukisa Emmanuel"
date: "4th May 2026"
---

# Slide 1: Title Slide
## Tereka: Automated Personal Finance Manager
- **Student:** Mukisa Emmanuel
- **Course:** Python Programming Course
- **Instructor:** Ajwadh Jalal
- **Date:** 4th May 2026

---

# Slide 2: Introduction & Problem Statement
## The Problem We Face
- **Lack of Tracking:** Daily expenses (transport, food, airtime) are often unrecorded.
- **Poor Budgeting:** Relying on memory or notebooks leads to overspending and financial stress.
- **Context Gap:** Existing commercial tools are complex, costly, and lack local context.

## The Solution
**Tereka** is a Python-based web application that simplifies tracking income, monitoring expenses, and managing monthly budgets securely.

---

# Slide 3: Project Objectives
## What Tereka Aims to Achieve
- **Secure Data Storage:** Safely record personal income and expenses.
- **Automated Categorization:** View spending patterns clearly.
- **Budget Control:** Set monthly limits and receive visual alerts when limits are exceeded.
- **Automated Reporting:** Generate easy-to-read monthly financial summaries.
- **Accessibility:** Provide a clean, user-friendly interface.

---

# Slide 4: System Architecture & Technology Stack
## How It Is Built
- **Architecture:** 3-Tier Web Application (Model-View-Controller)
- **Backend:** Python 3.x and **Flask**
- **Database:** **MySQL** (via XAMPP) for secure, relational data persistence.
- **Frontend:** HTML5, CSS3, and **Jinja2** Templating.
- **Security:** Passwords hashed securely using `Flask-Bcrypt`.

---

# Slide 5: Database Design
## Core Entities
- **Users Table:** Stores credentials securely (bcrypt hashes).
- **Transactions Table:** Logs income/expenses with amounts, categories, and dates.
- **Budgets Table:** Stores user-defined monthly spending limits per category.

*(Optional: Insert a diagram of the Database Schema here if available)*

---

# Slide 6: Secure User Authentication
## Registration & Login
- Independent, secure accounts for every user.
- Sessions ensure data privacy.

> **[Insert Screenshot 1: Login or Registration Page]**

---

# Slide 7: Main Dashboard
## Real-Time Financial Overview
- Instantly see Income, Expenses, and Net Balance for the current month.
- View recent transactions at a glance.
- Dashboard alerts warn you immediately if you are over budget.

> **[Insert Screenshot 2: The Main Dashboard showing totals and budget alerts]**

---

# Slide 8: Managing Transactions
## Logging & History
- Easy-to-use form to log daily spending.
- Filter past transactions by month to track historical data.

> **[Insert Screenshot 3: The Add Transaction form or the Transactions Table]**

---

# Slide 9: Budget Tracking
## Keeping Spending in Check
- Set specific limits for categories like Food, Transport, and Airtime.
- Visual progress bars indicate how close you are to the limit.
- Color-coded feedback (turns red when over limit).

> **[Insert Screenshot 4: The Budgets page showing the visual progress bars]**

---

# Slide 10: Automated Monthly Reports
## Financial Analysis
- Calculates daily average spending.
- Identifies the single biggest expense of the month.
- Provides a comprehensive breakdown of where money went.

> **[Insert Screenshot 5: The Monthly Report page]**

---

# Slide 11: Challenges & Solutions
## Overcoming Development Hurdles
- **Challenge:** Securing user data and preventing SQL Injection.
  - **Solution:** Used `Flask-Bcrypt` for hashing and parameterized queries (`%s`).
- **Challenge:** Template rendering errors (e.g., 500 Internal Server Error on Budgets).
  - **Solution:** Debugged Jinja2 syntax to correctly display dynamic progress bars.
- **Challenge:** Database connection leaks.
  - **Solution:** Implemented `try-except-finally` blocks to ensure connections close gracefully.

---

# Slide 12: Future Enhancements
## What's Next for Tereka?
- **Data Visualization:** Add interactive pie and bar charts (e.g., Chart.js).
- **Mobile Money Integration:** Automate imports from MTN/Airtel Money via SMS parsing.
- **Cloud Deployment:** Host online (e.g., Heroku, PythonAnywhere) for global access.
- **Export Data:** Allow exporting reports to PDF or Excel formats.

---

# Slide 13: Conclusion
## Summary
Tereka successfully demonstrates how Python can be used to build a robust, production-quality web application. It directly addresses the real-world problem of financial mismanagement by providing a locally-relevant, easy-to-use digital tracking tool.

---

# Slide 14: Q & A
## Thank You!
**Any Questions?**

---
*End of Presentation*
