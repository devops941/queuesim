# QueueSim — Service Counter Congestion & Waiting-Time Simulation Engine

An enterprise-grade discrete-event simulation platform designed to model, analyze, and optimize multi-server queuing networks across service counters (such as banks, hospital triage desks, college administration offices, and transit ticket counters).

QueueSim combines stochastic operations research with **SimPy 4**, asynchronous task queues, and a modern **React 19 + Vite** responsive dashboard to provide quantitative insights into customer wait times, queue buffer dynamics, counter utilization, and staffing bottlenecks.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Existing System vs Proposed System](#existing-system-vs-proposed-system)
3. [System Architecture & Working Flow](#system-architecture--working-flow)
4. [Complete Module Breakdown](#complete-module-breakdown)
5. [Technology Stack](#technology-stack)
6. [Environment Variables Configuration (.env)](#environment-variables-configuration-env)
7. [Step-by-Step Setup & How to Run](#step-by-step-setup--how-to-run)
8. [API Reference Summary](#api-reference-summary)
9. [Mathematical & Simulation Methodology](#mathematical--simulation-methodology)
10. [Troubleshooting & Resilient Fallback](#troubleshooting--resilient-fallback)

---

## Project Overview

Organizations operating physical service counters frequently suffer from service congestion, customer churn (baulking/reneging), unpredictable waiting times, and inefficient labor allocation. 

**QueueSim** solves this by delivering an end-to-end stochastic simulation engine:
* **Interactive Scenario Builder:** Define multi-counter topologies, arrival distributions (Exponential, Fixed), and service models (Exponential, Normal, Uniform, Fixed).
* **Monte Carlo Replications:** Execute multiple independent replications with deterministic pseudo-random seed sequences to compute statistically robust 95% confidence intervals ($t$-distribution).
* **Live Operations Dashboard:** Monitor queue dynamics $L(t)$, wait histograms, server workloads $\rho$, and throughput.
* **Scenario Comparison & Sensitivity:** Sweep server counts ($c = 1 \dots 8$) and arrival rates ($\lambda$) to evaluate trade-offs before physical counter expansion.
* **Automated Audit & Compliance:** One-click PDF reports (ReportLab) and CSV exports with full configuration snapshots.

---

## Existing System vs Proposed System

| Dimension | Existing / Traditional System | Proposed System (QueueSim) |
|---|---|---|
| **Analysis Methodology** | Static spreadsheets or manual headcount observations with no variance tracking. | Dynamic discrete-event simulation (DES) modeling individual customer lifecycle events. |
| **Queuing Theory Constraints** | Basic analytical $M/M/1$ or $M/M/c$ steady-state formulas that fail with non-exponential distributions or transient warm-ups. | Generalized $M/G/c$ modeling with warm-up exclusion and multi-distribution support (Normal, Uniform, Fixed). |
| **Uncertainty & Variability** | Single point estimates (average only), masking peak customer delay and line spikes. | Multi-replication Monte Carlo simulation outputting 95% Confidence Intervals, P90, and P99 tail metrics. |
| **Sensitivity Testing** | Trial-and-error physical staffing adjustments causing operational disruptions. | In-software sensitivity sweeps varying server counts, service durations, and arrival intervals. |
| **Visual Analytics** | Static tables and disconnected charts. | Interactive Bento Analytics, real-time telemetry, queue depth distributions, and Kingman's trade-off curves. |
| **Enterprise Readiness** | Fragmented scripts with no role management or export capability. | Multi-tenant JWT auth, audit logging, ReportLab PDF generation, and resilient database fallback. |

---

## System Architecture & Working Flow

```
[ User Browser / Client ]
           │
           ▼
[ React 19 + TypeScript + Tailwind UI (Vite) ]
           │
           │  REST API (Axios / JWT Auth)
           ▼
[ FastAPI Application Gateway (Port 8000) ]
     ├── Authentication & Security (JWT, Bcrypt)
     ├── Scenario & Parameter Management
     ├── Data Validation & CSV Import Engine
     └── Analytics & Comparison Aggregator
           │
     ┌─────┴────────────────────────┐
     ▼                              ▼
[ MongoDB Atlas / Local ]     [ Execution Router ]
(Scenarios, Runs, Reports)          │
                                    ├───► [ Celery + Redis ] (Distributed Worker)
                                    └───► [ Inline Async Worker ] (Zero-dependency Fallback)
                                                │
                                                ▼
                                    [ SimPy Discrete-Event Engine ]
                                    ├── Customer Arrival Generator (λ)
                                    ├── Multi-Server Resource Allocation (c)
                                    ├── Stochastic Service Sampler (μ)
                                    └── Event Collector & Warm-up Filter
                                                │
                                                ▼
                                    [ Monte Carlo Aggregator ]
                                    ├── 95% Student-t CI Calculation
                                    ├── Time-Weighted Queue Metrics
                                    └── Percentiles (Mean, Median, P90, Max)
```

### Detailed Workflow:
1. **User Authentication:** Admin or operator logs in via JWT authentication (`/api/v1/auth/login`) and selects their workspace.
2. **Scenario Setup:** The user configures service parameters (number of counters, time horizon, warm-up period, replications, random seed) and assigns stochastic distributions for arrival and service intervals.
3. **Validation & Storage:** FastAPI validates inputs using strict Pydantic v2 schemas; parameters are stored in MongoDB (with memory-store safety fallback).
4. **Simulation Execution:**
   * If Redis/Celery is available, jobs are queued across worker processes.
   * If Redis is unavailable, the backend seamlessly triggers non-blocking inline `asyncio` execution.
5. **SimPy Discrete-Event Simulation:** Each replication spawns customers, tracks waiting times, logs queue changes, and registers server busy/idle intervals.
6. **Analytics Aggregation:** The engine strips warm-up transient data, calculates time-weighted average queue lengths, generates histograms, and computes 95% confidence bounds.
7. **Interactive Dashboard:** Results are visualised via Recharts on the Overview Dashboard, Queue Dynamics Analysis, and Counter Utilization pages.
8. **Export & Audit:** Operators export comprehensive PDF reports or CSV audit records.

---

## Complete Module Breakdown

### Module 01: Authentication, Workspaces & Role-Based Access Control
* **JWT Token Security:** Standardized access token (15-min lifetime) and rotating refresh token (7-day lifetime).
* **Multi-Tenancy:** Workspaces isolate scenarios, runs, and reports between teams and operators.
* **Roles:** Admin, Owner, Member with fine-grained route permissions.
* **Pre-configured Default Admin:** `admin@gmail.com` / `Admin@123`.

### Module 02: Scenario Configuration & Preset Architecture
* **Pre-configured Presets:**
  * *Bank Counter Peak Hours:* 3 servers, Exponential arrival ($\lambda=20/\text{hr}$), Exponential service ($\mu=7.5/\text{hr}$).
  * *Clinic Registration Desk:* 2 servers, Gaussian service times ($\mu=10.0\text{ min}$, $\sigma=2.0\text{ min}$).
  * *College Admission Office:* Single counter, Uniform transaction times ($5\text{ to }15\text{ min}$).
  * *Transit Hub Ticket Box:* 4 servers modeling high-volume surge intervals.
* **CRUD Engine:** Full validation, draft/ready states, and parameter cloning.

### Module 03: Arrival & Service Distribution Engine
* **Arrival Models:** Fixed inter-arrival intervals, Exponential (Poisson arrival process).
* **Service Models:** Exponential (Markovian), Normal (Gaussian), Uniform (bounded min-max), Fixed deterministic.
* **Stochastic Validation:** Automated parameter boundary checks (ensures $\lambda > 0$, $\mu > 0$, $\sigma < \text{mean}$).

### Module 04: Real-World Dataset Import & Quality Inspection
* **CSV Ingestion:** Support for field-recorded arrival and service timestamps.
* **Column Mapping:** Flexible mapping of arrival time, service start, and service end fields.
* **Data Cleansing:** Automated detection of timestamp inversions, missing values, and negative durations.

### Module 05: SimPy Discrete-Event Simulation Core
* **Event Generator:** Generates customer entities with timestamps for arrival, queue entry, service start, and departure.
* **Resource Modeling:** `simpy.Resource(capacity=servers)` enforces strict FIFO queue discipline.
* **Warm-up Handling:** Discards transient startup phases to measure true steady-state equilibrium.
* **Deterministic Randomness:** Base seed derives independent seeds per replication using NumPy `default_rng`.

### Module 06: Asynchronous Simulation Execution & Task Routing
* **Hybrid Execution:** Celery distributed task pipeline with automatic graceful degradation to background `asyncio` threads.
* **Run Monitoring:** Real-time percentage progress tracking (`queued` $\to$ `running` $\to$ `completed` / `failed`).
* **Run Cancellation:** Cooperative cancellation endpoints to terminate runaway jobs.

### Module 07: Performance Analytics & KPI Dashboard
* **Primary Key Performance Indicators:**
  * Average & Maximum Waiting Time ($W_q$, $W_{max}$)
  * Time-Weighted Average Queue Length ($L_q$)
  * Server Utilization ($\rho$)
  * Service Efficiency and Throughput ($X$)
  * Statistical percentiles (Median, P90, P99)
* **Bento Visualizations:**
  * Continuous $L(t)$ Queue Length area profile with 95% Upper Confidence Bound.
  * Customer waiting time frequency distribution histograms.
  * Individual counter workload and idle capacity breakdown.
  * Arrival velocity vs service capacity ($\lambda \text{ vs } c\mu$).

### Module 08: Scenario Comparison & Sensitivity Analysis
* **Multi-Run Benchmarking:** Side-by-side metric delta comparison across 2–5 simulation runs.
* **Parameter Sweeps:** Automated sensitivity testing varying server counts ($c = 1 \dots 8$) or arrival rates ($\lambda$) to locate the queue stability knee point ($\rho < 1$).

### Module 09: Automated Reporting & Data Exports
* **PDF Report Generation:** Professional ReportLab documents containing executive summaries, KPI tables, and parameter audit trails.
* **CSV Exports:** Export raw replication summaries, event logs, and aggregate metrics.

### Module 10: Administration, Resilient Store & System Operations
* **Atlas Free-Tier Quota Resilience:** Includes built-in `MEMORY_STORE` protection against MongoDB Atlas collection quota limits (Atlas error code 8000).
* **Audit Logging:** Cryptographically indexed event logs for system boot, login, configuration, and data wipe actions.
* **Ops Endpoints:** System health checks (`/health`, `/ready`, `/version`) measuring live database and engine latencies.

---

## Technology Stack

| Layer | Component | Version / Library |
|---|---|---|
| **Frontend** | Framework | React 19 + TypeScript + Vite 6 |
| | Styling & Icons | Tailwind CSS + Lucide React |
| | Visualizations | Recharts (Area, Bar, Line) |
| | State & Fetching | Zustand + TanStack React Query v5 |
| **Backend** | API Framework | Python 3.12 + FastAPI |
| | Schemas & Validation | Pydantic v2 + Pydantic Settings |
| | Simulation Engine | SimPy 4 + NumPy + SciPy |
| | Asynchronous DB Driver | Motor (AsyncIOMotorClient) + PyMongo |
| | Security & Auth | Python-Jose + Passlib (Bcrypt) |
| | Task Queue | Celery + Redis (optional/configurable) |
| | PDF Generation | ReportLab |
| **Databases** | Primary Database | MongoDB (Atlas or Local `localhost:27017`) |
| | Broker / Cache | Redis (Port 6379) |

---

## Environment Variables Configuration (.env)

The project utilizes environment files for backend and frontend configuration.

### 1. Backend Configuration (`backend/.env` or root `.env`)

Create a `.env` file in the `backend/` folder (or project root):

```env
# ==========================================
# Application Environment & Naming
# ==========================================
APP_ENV=development
APP_NAME=QueueSim
API_PREFIX=/api/v1
ENGINE_VERSION=1.0.0
LOG_LEVEL=INFO

# ==========================================
# MongoDB Database Configuration
# ==========================================
# For Local MongoDB (Default):
MONGODB_URI=mongodb://localhost:27017
# For MongoDB Atlas Cloud Cluster:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority

MONGODB_DATABASE=QueueSim

# ==========================================
# Security & JWT Authentication
# ==========================================
# 32+ character secret key for cryptographic JWT signing
JWT_SECRET=9faa55212384bec04378bf22a924c1f5514eb7d92c21ee1377d5b9156cae1a9d
JWT_ACCESS_MINUTES=15
JWT_REFRESH_DAYS=7

# ==========================================
# CORS Allowlist
# ==========================================
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173

# ==========================================
# Asynchronous Background Queue (Celery / Redis)
# ==========================================
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# ==========================================
# Storage & Upload Limits
# ==========================================
MAX_UPLOAD_MB=10
OBJECT_STORAGE_PATH=./storage
```

#### Detailed Variable Description:
* `MONGODB_URI`: Connection string for MongoDB. Works with local MongoDB (`mongodb://localhost:27017`) or cloud Atlas clusters.
* `MONGODB_DATABASE`: The database namespace used by QueueSim (Default: `QueueSim`).
* `JWT_SECRET`: Random 256-bit hexadecimal string used to sign access tokens and refresh tokens.
* `JWT_ACCESS_MINUTES`: Expiration window for user access tokens (Default: 15 minutes).
* `JWT_REFRESH_DAYS`: Refresh token session duration (Default: 7 days).
* `REDIS_URL` & `CELERY_BROKER_URL`: Connection to Redis for task dispatch. *(Note: If Redis is not running, QueueSim automatically falls back to non-blocking inline async processing).*
* `CORS_ORIGINS`: Comma-separated list of allowed frontend origins to prevent browser CORS blocks.
* `OBJECT_STORAGE_PATH`: Directory path for persistent storage of exported PDF and CSV files.

---

### 2. Frontend Configuration (`frontend/.env`)

Create a `.env` file in the `frontend/` folder:

```env
# URL pointing to the FastAPI backend API prefix
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Step-by-Step Setup & How to Run

### Option A: Local Development (Standard Windows / Linux / macOS)

#### Prerequisites:
* Python 3.10+ (Python 3.12 recommended)
* Node.js 18+ (Node 20+ recommended)
* MongoDB (Local service or MongoDB Atlas account)

---

#### Step 1: Set Up Backend

1. Open a terminal and navigate to the `backend` directory:
   ```powershell
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```powershell
   # Windows PowerShell:
   python -m venv .venv
   .venv\Scripts\Activate.ps1

   # Linux / macOS:
   # python3 -m venv .venv
   # source .venv/bin/activate
   ```
3. Install required dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Configure `.env`:
   Make sure `backend/.env` is created with the variables outlined above.
5. Start the FastAPI backend server:
   ```powershell
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   * The API server will be live at: `http://localhost:8000`
   * Interactive Swagger Documentation: `http://localhost:8000/api/v1/docs`

---

#### Step 2: Set Up Frontend

1. Open a second terminal and navigate to the `frontend` directory:
   ```powershell
   cd frontend
   ```
2. Install Node dependencies:
   ```powershell
   npm install
   ```
3. Ensure `frontend/.env` contains:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```
4. Start the Vite development server:
   ```powershell
   npm run dev
   ```
5. Open your web browser and navigate to:
   ```
   http://localhost:5173
   ```

---

#### Step 3: Default Login Credentials

You can sign in immediately using the pre-configured credentials:
* **Email:** `admin@gmail.com`
* **Password:** `Admin@123`
*(Or click the "Auto-fill Admin Credentials" shortcut on the login screen).*

---

### Option B: Running with Docker Compose

If you have Docker Desktop installed, run the entire stack with a single command:

```bash
# From project root
cd infra
docker compose up --build -d
```
* **Frontend:** `http://localhost`
* **Backend API Docs:** `http://localhost:8000/api/v1/docs`

---

## API Reference Summary

Base URL: `http://localhost:8000/api/v1`

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Authentication** | `POST` | `/auth/login` | Authenticate user, receive access & refresh tokens |
| | `POST` | `/auth/register` | Register a new user and initialize a default workspace |
| | `POST` | `/auth/refresh` | Exchange valid refresh token for a fresh access token |
| | `GET` | `/auth/me` | Fetch logged-in user profile and accessible workspaces |
| **Scenarios** | `GET` | `/scenarios` | List scenarios within active workspace |
| | `POST` | `/scenarios` | Create a new scenario with arrival & service distributions |
| | `GET` | `/scenarios/{id}` | Retrieve scenario parameters and status |
| | `PATCH` | `/scenarios/{id}` | Update scenario configuration |
| | `POST` | `/scenarios/{id}/validate` | Validate stochastic rules and transition status to `ready` |
| **Simulations** | `POST` | `/scenarios/{id}/runs` | Trigger a new multi-replication SimPy simulation |
| | `GET` | `/runs/{run_id}` | Check simulation execution progress (0% - 100%) |
| | `GET` | `/runs/{run_id}/metrics` | Retrieve aggregated Monte Carlo statistics & CI values |
| | `POST` | `/runs/{run_id}/cancel` | Abort a running simulation |
| **Analytics** | `GET` | `/analytics/dashboard` | Retrieve workspace dashboard summary and recent runs |
| | `GET` | `/analytics/compare` | Compare metrics across 2 to 5 completed runs |
| **Exports & Ops** | `POST` | `/reports` | Request PDF or CSV report generation |
| | `GET` | `/reports/{id}/download` | Stream generated PDF/CSV file to browser |
| | `POST` | `/admin/clear-data` | Purge simulation runs and reset data store |
| | `GET` | `/admin/health` | Comprehensive infrastructure and latency health probe |

---

## Mathematical & Simulation Methodology

### 1. Queuing Process Notation: $M/G/c$
QueueSim models single-queue, parallel-server networks where:
* **$M$:** Arrival process follows a Poisson distribution with mean inter-arrival time $1/\lambda$.
* **$G$:** General service time distribution (Exponential, Gaussian, Uniform, or Deterministic) with mean $1/\mu$.
* **$c$:** Number of parallel, homogeneous service counters.

### 2. Time-Weighted Average Queue Length ($L_q$)
Rather than sampling customer counts at arbitrary moments, QueueSim computes the continuous time integral of queue depth:
$$L_q = \frac{1}{T - T_{warm}} \int_{T_{warm}}^{T} Q(t) \, dt$$
where $T$ is the simulation horizon and $T_{warm}$ is the warm-up cutoff.

### 3. Traffic Intensity ($\rho$) & Stability
Server utilization across $c$ counters is calculated as:
$$\rho = \frac{\lambda}{c \cdot \mu} = \frac{\text{Total Busy Server Time}}{c \cdot (T - T_{warm})}$$
A system is ergodic and stable if and only if $\rho < 1.0$. If $\rho \ge 1.0$, the queue diverges toward infinity.

### 4. Little's Law Consistency
Across all dashboards, the relationship between average queue length $L_q$, arrival rate $\lambda$, and average waiting time in queue $W_q$ is validated:
$$L_q = \lambda \cdot W_q$$

### 5. Monte Carlo Confidence Intervals
For $N$ independent replications, the 95% confidence interval for mean waiting time is calculated via the Student-$t$ distribution ($df = N - 1$):
$$\overline{W} \pm t_{0.975, N-1} \cdot \frac{S}{\sqrt{N}}$$

---

## Troubleshooting & Resilient Fallback

* **MongoDB Atlas Limit (Code 8000):**
  If using a shared free-tier MongoDB Atlas cluster that has exhausted its 500-collection limit, QueueSim's built-in **`MEMORY_STORE`** in `backend/app/core/database.py` automatically intercepts write failures and serves simulation requests from high-performance in-memory state.
* **Redis Connection Errors:**
  If Redis is not installed locally, QueueSim catches broker connection exceptions and automatically executes simulations inline using `asyncio.to_thread` with zero setup required.
* **Port Conflicts:**
  * If Port `8000` is busy: `uvicorn app.main:app --port 8001 --reload`
  * If Port `5173` is busy: Vite will automatically suggest port `5174`. Update `VITE_API_BASE_URL` in `frontend/.env` accordingly.

---

*QueueSim — Built with Python, FastAPI, SimPy, MongoDB, React, TypeScript, and Tailwind CSS.*
