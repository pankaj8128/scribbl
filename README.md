# Scribbl - Real-Time Multiplayer Drawing System

A scalable real-time multiplayer drawing and guessing game inspired by Skribbl.io, built with a focus on distributed system design, low-latency communication, and event-driven architecture.

---

## Live Demo
https://scribbl-2nmw.onrender.com/

---

## System Overview

Scribbl is designed as a **real-time distributed system** where multiple clients interact simultaneously through WebSockets, with a backend architecture optimized for scalability and low-latency event propagation.

---

## Architecture


Key principles:
- Event-driven communication
- Stateless backend nodes
- Horizontal scalability
- Real-time synchronization

---

## Tech Stack

- **Backend:** Node.js, Express.js  
- **Real-time:** WebSockets (ws)  
- **Frontend:** HTML5 Canvas, JavaScript  
- **Database:** PostgreSQL (design-ready)  

---

## Key Features

### Real-Time Gameplay
- Instant drawing synchronization across clients
- Bidirectional communication using WebSockets

### Room-Based Architecture
- Isolated game sessions per room
- Independent state management

### Low-Latency Event System
- Optimized event broadcasting
- Minimal redundant updates

### Cross-Device Support
- Responsive canvas rendering
- Touch input support for mobile devices

### Game Logic Engine
- Turn-based drawing system
- Server-authoritative scoring
- Leaderboard computation

---

## Scalability Design

The system is designed to scale horizontally:

- Multiple WebSocket servers behind a load balancer
- Stateless backend nodes for easy scaling
- Persistent storage for game history (future-ready)

---

## Reliability & Integrity

- Server-side validation for all game actions
- Prevention of unauthorized drawing
- Reconnection-ready architecture (design-level)

---

## Future Improvements

- Redis-based distributed state management and Pub/Sub for cross-server event sync
- Kafka-based event streaming for large-scale concurrency

---

## Author

Pankaj Jagadale  
- GitHub: [@pankaj8128](https://github.com/pankaj8128)
- LinkedIn: https://linkedin.com/in/pankaj8128

---

## Purpose of Project

This project was built to explore:
- Real-time distributed systems
- WebSocket scaling challenges
- Event-driven backend design
- Low-latency multiplayer synchronization
