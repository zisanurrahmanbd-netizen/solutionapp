# Bank File Tracking & Recovery Management System

[![Laravel 11](https://img.shields.io/badge/Laravel-11.x-FF2D20?style=for-the-badge&logo=laravel)](https://laravel.com)
[![PHP 8.3](https://img.shields.io/badge/PHP-8.3-777BB4?style=for-the-badge&logo=php)](https://php.net)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![Leaflet](https://img.shields.io/badge/Leaflet-OpenStreetMap-199900?style=for-the-badge&logo=leaflet)](https://leafletjs.com)
[![Tests](https://img.shields.io/badge/Tests-21%20Passed%20(100%25)-10B981?style=for-the-badge)](tests)

A production-ready Laravel web application built to replace spreadsheet-based debt recovery operations with a secure, multi-tenant, role-scoped recovery tracking platform. Handles recovery files across multiple banks (**One Bank, Dutch-Bangla Bank, Asian Paints Dealer Recovery**) and product categories (Credit Cards, Personal Loans, SME / Agent Banking Loans, Dealer Overdues).

---

## 🌟 Key Features

1. **Multi-Role Access Control (RBAC)**
   - **Admin**: Full access across all banks, agents, files, Excel importer, and team management.
   - **Manager**: Strictly scoped to their own team's agents and files; can reassign files within their team; read-only reports.
   - **Agent**: Strictly restricted to their assigned cases only; logs GPS visit check-ins and records collections.
   - **Dual-Layer Security**: Enforced via route middleware (`role:*`) and database query scopes (`CaseFile::forUser($user)`).

2. **Unified Data Model & Config-Driven Excel Importer**
   - Ingests heterogeneous bank spreadsheets (loans, credit cards, dealer ledgers) into a unified `cases` schema.
   - Bank/product schema mappings configured in `config/bank_mappings.php` with regex sheet detection and auto-header aliasing.
   - Interactive CLI importer (`php artisan bank:import-excel`) and Web UI with drag-and-drop, sheet inspection, dry-run preview, and asynchronous queueing.
   - Preserves bank-specific unstructured fields inside JSON `extra_attributes`.

3. **GPS Field Visit Check-In & Live Tracking Map**
   - Field agents log visits capturing precise browser GPS coordinates (`latitude`, `longitude`, `accuracy`), notes, and address type (Present vs. Permanent).
   - Automatically tracks visit history (`check_ins`) and sets `present_address_visited` / `permanent_address_visited` indicators.
   - Live Leaflet.js / OpenStreetMap tracking map with real-time agent location markers, online/offline status, and 15-second auto-polling.

4. **Real-Time Operational Dashboard**
   - KPI cards (Total Portfolio, Active Files, Month-to-Date Collections, Recovery Rate %, Visit Coverage %).
   - Chart.js 6-month collection trend line chart and portfolio allocation doughnut chart.
   - Field Agent Leaderboard with live recovery totals and ranking badges.
   - Urgent Expiry Watchlist (files expiring within 7 days).
   - 15-second background polling via Alpine.js for live dashboard updates without page reloads.

5. **Operational Reports & Matrix Tracker**
   - **Agent Performance Report**: Visit counts, collection counts, total recovery BDT, average collection size with CSV export.
   - **Expiry Matrix Tracker**: Cross-tab matrix of banks × expiry buckets (Active, ≤7d, ≤30d, Expired, Settled).
   - **Flagged & Legal Cases Registry**: Centralized view for Legal notices, Artha Rin suits, 138 NI Act cheque bounce cases, and untraceable accounts.
   - **Bank Contacts Directory**: Direct liaison phone/email directory for recovery managers across partner banks.

---

## 🔐 Default Demo Accounts

All demo accounts use the standard password: **`password123`**

| Role | Email | Name / Department | Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@recovery.local` | System Administrator | Full access to all banks, teams, imports, reports |
| **Manager** | `manager.dhaka@recovery.local` | Shafiqur Rahman (Dhaka Team) | Dhaka agents (`agent.rahim`, `agent.karim`, `agent.nasrin`) |
| **Manager** | `manager.ctg@recovery.local` | Kamal Hossain (Chittagong Team) | Chittagong agents (`agent.jahangir`, `agent.sultana`) |
| **Agent** | `agent.rahim@recovery.local` | Md. Abdur Rahim | Assigned One Bank & Asian Paints cases |
| **Agent** | `agent.karim@recovery.local` | Md. Karim Uddin | Assigned One Bank CC & Asian Paints cases |
| **Agent** | `agent.nasrin@recovery.local` | Nasrin Akter | Assigned One Bank Legal & Asian Paints cases |
| **Agent** | `agent.jahangir@recovery.local` | Jahangir Alam | Assigned DBBL Agent Banking cases |
| **Agent** | `agent.sultana@recovery.local` | Sultana Begum | Assigned DBBL Settled & Branch Loan cases |

---

## 🚀 Local Quickstart Guide

### Prerequisites
- PHP 8.2 or 8.3 with `pdo_sqlite`, `pdo_mysql`, `mbstring`, `gd`, `zip`, `xml` extensions enabled
- Composer 2.x

### 1. Clone & Install Dependencies
```bash
git clone <repo-url> bank-recovery-system
cd bank-recovery-system
composer install
```

### 2. Configure Environment
```bash
cp .env.example .env
php artisan key:generate
```

*For quick local testing, SQLite is used by default:*
```bash
touch database/database.sqlite
```

### 3. Run Migrations & Seed Sample Data
```bash
php artisan migrate:fresh --seed
```
*This seeds roles, all demo accounts, partner banks, products, sample cases with GPS check-ins, and collections.*

### 4. Generate Sample Excel Workbooks (Optional)
Generate realistic test `.xlsx` workbooks for One Bank, DBBL, and Asian Paints:
```bash
php sample_data/generate_sample_workbooks.php
```
Workbooks will be generated inside the `sample_data/` folder.

### 5. Start Local Development Server
```bash
php artisan serve
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser and log in with any demo credential.

---

## 📊 Running the Excel Importer

### Method A: Via Web Interface (Admin Only)
1. Log in as `admin@recovery.local`.
2. Navigate to **Excel Importer** in the sidebar.
3. Drag & drop any `.xlsx` workbook (e.g. `sample_data/OneBank_Recovery_Workbook.xlsx`).
4. Click **Inspect Sheets** to inspect sheet schemas without importing.
5. Select the target sheet, check *Run in background queue* if desired, and click **Start Import**.

### Method B: Via Artisan CLI
Run the interactive importer:
```bash
php artisan bank:import-excel sample_data/OneBank_Recovery_Workbook.xlsx
```
Run non-interactively for automated/cron pipelines:
```bash
php artisan bank:import-excel sample_data/OneBank_Recovery_Workbook.xlsx --sheet=OneBank_CreditCard
```
Dry-run test without saving to database:
```bash
php artisan bank:import-excel sample_data/DBBL_Recovery_Workbook.xlsx --sheet=DBBL_AgentBanking --dry-run
```

---

## 🐳 Docker Deployment (Production Ready)

A multi-container setup with **PHP 8.3 FPM + Nginx + Supervisor + MySQL 8.0 + Redis 7** is included.

### 1. Start Docker Compose
```bash
docker compose up -d --build
```

### 2. Initialize the Application
```bash
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed --force
```

### 3. Access Application
Navigate to **[http://localhost:8080](http://localhost:8080)**.

---

## 🧪 Running Automated Tests

Run the complete feature & unit test suite:
```bash
php artisan test
```
*Test suite includes:*
- `AuthenticationTest`: Login, invalid credentials, inactive status blocking, logout.
- `CaseScopingTest`: Role-based database query scoping contracts for Admin, Manager, and Agent.
- `CheckInAndCollectionTest`: Geolocation check-ins, address visit flags, partial collections, and automatic case settlement.
- `ExcelImportTest`: Workbook schema inspection, automated sheet matching, and case record creation.

---

## 📁 Project Architecture & Directory Structure

```
bank-recovery-system/
├── app/
│   ├── Console/Commands/ImportExcelCommand.php   # Artisan CLI: bank:import-excel
│   ├── Http/Controllers/
│   │   ├── AuthController.php                    # Authentication & session control
│   │   ├── DashboardController.php               # KPI metrics & live polling API
│   │   ├── CaseController.php                    # Scoped case queries, detail, edit, reassignment
│   │   ├── CheckInController.php                 # GPS check-in logging & visit flags
│   │   ├── CollectionController.php              # Payment receipts & auto-settlement
│   │   ├── AgentTrackingController.php           # Leaflet map & live GPS pings
│   │   ├── ExcelImportController.php             # Web Excel upload & inspection
│   │   ├── ReportController.php                  # Performance, Expiry & Flagged reports
│   │   ├── BankContactController.php             # Bank liaison contacts
│   │   └── UserController.php                    # Team & agent account management
│   ├── Http/Middleware/
│   │   └── EnsureUserIsActive.php                # Blocks deactivated accounts
│   ├── Jobs/ProcessExcelImportJob.php            # Queued background import worker
│   ├── Models/
│   │   ├── CaseFile.php                          # Scopes: forUser, active, expiringSoon, expired, flagged
│   │   ├── CheckIn.php                           # Geolocation visit check-in record
│   │   ├── Collection.php                        # Payment receipt
│   │   ├── Bank.php & Product.php                # Partner institutions & product lines
│   │   ├── BankContact.php                       # Contact directory entries
│   │   ├── AgentLocation.php                     # Breadcrumb location history
│   │   └── ImportJob.php                         # Audit log for import operations
│   └── Services/
│       ├── ExcelImportService.php                # PhpSpreadsheet parser & unified mapper
│       └── DashboardMetricService.php            # KPI aggregation & chart datasets
├── config/bank_mappings.php                      # Config-driven sheet & column mapping rules
├── database/
│   ├── migrations/                               # 10 comprehensive relational migrations
│   └── seeders/DatabaseSeeder.php                # Full demo database seeder
├── docker/                                       # Docker configurations (Nginx & Supervisor)
├── resources/views/                              # Tailwind CSS + Alpine.js Blade views
├── sample_data/                                  # Realistic .xlsx test workbooks & generator
└── tests/Feature/                                # Automated test suite (100% passing)
```

---

## 📄 License
Open-source software licensed under the [MIT license](LICENSE).