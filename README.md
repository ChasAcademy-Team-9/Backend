# Climate-Controlled Transport System (Prototype) - Backend

## Overview
This repository contains the **backend implementation** of the prototype system for **climate-controlled transport**, developed by the backend team at Chas Advance.  

The system is designed to support climate monitoring and tracking during transportation of sensitive goods such as:
- Food and beverages  
- Pharmaceuticals  
- Certain chemicals  
- Other goods requiring strict climate control  

Our backend provides the core functionality for managing data flows between senders, transporters, receivers, and logistics managers.  

---

## Scope of the Prototype
The prototype backend focuses on:
- **Data handling and APIs** for package registration, tracking, and monitoring.  
- **Sensor integration simulation** (temperature, humidity, and location).  
- **Event-driven notifications** when conditions (e.g., temperature or humidity) deviate from thresholds.  
- **Role-based data views** (via API responses) depending on user type.  

> Note: Sender registration, ordering of sensor units, and booking transports are **out of scope** for this prototype.

---

## Roles & Responsibilities

### 1. Sender
- Registers packages with pre-assigned sensor units (simulation).  
- Receives a **shipment label** with a QR/barcode for demo purposes.  
- Can view current data for their packages (position, temperature, humidity).  
- Possible improvements: notifications, history view, multiple-package dashboard.  

### 2. Transporter
- Scans received packages using the app (barcode/QR integration).  
- Links package(s) to a truck and starts sensor data logging.  
- Access to live monitoring per package.  
- Receives **alerts** when climate conditions risk being breached.  

### 3. Receiver
- Can track their shipments in real time (similar to sender, but only for their own packages).  
- Confirms delivery by scanning the shipment label (ends logging).  
- Receives a **delivery report** including climate status during transport.  

### 4. Logistics Manager (internal role)
- Access to aggregated data views:  
  - Per truck  
  - Per customer  
  - Per time interval  
  - Filtered by broken cold/humidity chains  
- Lower priority in prototype, but provides extended monitoring and analysis.  

---

## Technical Implementation

### Backend Responsibilities
- **API Development**: REST/GraphQL endpoints for data access.  
- **Database Management**: Store package, transport, sensor, and role-related data.  
- **Data Simulation**: Mock sensor inputs (temperature, humidity, location) for demo.  
- **Notification System**: Trigger alerts when climate conditions are outside allowed ranges.  
- **Role-Based Access**: Ensure different roles only access their relevant data.  

### Planned Tech Stack
- **Runtime**: Node.js / Express.js (or similar backend framework).  
- **Database**: PostgreSQL / MongoDB (to support both SQL and NoSQL options).  
- **Authentication**: JWT or OAuth 2.0 for secure access control.  
- **Testing**: Jest / Mocha for backend unit testing.  
- **API Documentation**: OpenAPI / Swagger.  

---

## Installation & Setup

1. **Clone repository**  
   ```bash
   git clone https://github.com/chas-advance/climate-transport-backend.git
   cd climate-transport-backend

