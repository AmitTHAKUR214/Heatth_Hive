# 🏥 Health Platform

### *Medicine Finder • Q&A System • Inventory Manager*

<p align="center">
  <b>A full-stack healthcare application focused on accessibility, community knowledge, and pharmacy management.</b>
</p>

---

## 🚀 Overview

Health Platform is a **multi-module full-stack web application** that combines:

* 🔍 Medicine discovery
* 💬 Community-driven Q&A (Quora-style)
* 📦 Inventory management for pharmacists

Built with a scalable architecture using **React, Node.js, and MongoDB Atlas**.

---

## ✨ Features

### 🔐 Authentication & Security

* Email-based user registration & verification
* JWT authentication system
* Protected routes & secure access

---

### 🔍 Medicine Finder

* Search and explore medicines
* Fast and user-friendly interface

---

### 💬 Q&A System

* Post and answer health-related questions
* Structured discussions
* Community interaction

---

### 📦 Inventory Management

* Add, edit, and manage medicine stock
* Dedicated pharmacist functionality

---

### 👥 Role-Based Access

* 👤 General Users
* 🧑‍⚕️ Pharmacists
* 🔄 Basic recommendation system based on role

---

## 🛠️ Tech Stack

| Frontend | Backend    | Database      |
| -------- | ---------- | ------------- |
| React    | Node.js    | MongoDB Atlas |
| HTML5    | Express.js |               |
| CSS3     |            |               |

---

## 🧠 Architecture

```id="arch1"
Frontend (React)
        ↓
REST API (Express.js)
        ↓
Database (MongoDB Atlas)
```

* Clean separation of frontend and backend
* API-driven communication
* Scalable modular structure

---

## 🔄 Core Flow

```id="flow1"
User Registration → Email Verification (JWT)
        ↓
Login → Authentication
        ↓
Access Features Based on Role
        ↓
- Medicine Search
- Q&A Interaction
- Inventory Management
```

---

## 📸 Screenshots
![Home](https://github.com/AmitTHAKUR214/Heatth_Hive/raw/f73eb233abdba88ee5d4814a162e68c68e6b105d/Screenshot%20From%202026-03-31%2015-45-34.png)

![Login](https://github.com/AmitTHAKUR214/Heatth_Hive/raw/9be78cca105ca909c7f1f4781132bc44f50459f4/Screenshot%20From%202026-01-16%2023-40-20.png)

![Dashboard](https://github.com/AmitTHAKUR214/Heatth_Hive/raw/9be78cca105ca909c7f1f4781132bc44f50459f4/Screenshot%20From%202026-03-31%2015-49-28.png)

![Q&A](https://github.com/AmitTHAKUR214/Heatth_Hive/raw/222724cad51583298b3f61cc6d7790fe1aecc074/Screenshot%20From%202026-01-05%2010-01-38.png)

![Inventory](https://github.com/AmitTHAKUR214/Heatth_Hive/raw/2d0c7afdd0d6addab220a8e88790dddd6c9e3cd7/Screenshot%20From%202026-03-31%2015-48-25.png)


---

## ⚙️ Installation & Setup

### 📦 Clone the Repository

```id="cmd1"
git clone https://github.com/AmitTHAKUR214/Heatth_Hive/tree/main
```

---

### 🔧 Backend Setup

```id="cmd2"
cd backend
npm install
```

Create `.env` file:

```id="env1"
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
```

Run backend:

```id="cmd3"
npm start
```

---

### 💻 Frontend Setup

```id="cmd4"
cd frontend
npm install
```

Create `.env`:

```id="env2"
VITE_CLIENT_URL=http://localhost:5173
```

Run frontend:

```id="cmd5"
npm run dev
```

---

## 📌 Project Status

🚧 **Work in Progress**
Continuously improving features, UI/UX, and performance.

---

## 💡 Highlights

* 🔥 Full-stack architecture
* 🔐 JWT-based authentication
* 👥 Role-based system
* 📦 Real-world use case (health + pharmacy)
* ⚡ API-driven design

---

## 📬 Contact

* GitHub: https://github.com/AmitTHAKUR214
* Email: [as6569884@gmail.com]

---

<p align="center">
  ⭐ If you like this project, consider giving it a star!
</p>
