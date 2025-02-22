# Task Management Application - Server Side

## Description

This is the backend for a Task Management Application built with Express.js and MongoDB. The server handles authentication, task management, and real-time updates.

## Technologies Used

- **Backend Framework:** Express.js
- **Database:** MongoDB
- **Authentication:** JSON Web Tokens (JWT)
- **Environment Variables:** dotenv
- **CORS Handling:** cors
- **Real-time Communication:** WebSockets (ws)

## Dependencies

```json
"dependencies": {
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "jsonwebtoken": "^9.0.2",
  "mongodb": "^6.13.0",
  "ws": "^8.18.1"
}
```

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/task-management-server.git
   cd task-management-server
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create a `.env` file in the root directory and add your environment variables:
   ```env
   DB_USER=MongoDB_User_Id
   DB_PASSWORD=MongoDB_User_Password
   JWT_SECRET=your_jwt_secret
   ```
4. Start the server:
   ```sh
   npm start
   ```

## API Endpoints

- **POST /tasks** - Add a new task
- **GET /tasks** - Retrieve all tasks for the logged-in user
- **PUT /tasks/:id** - Update task details
- **DELETE /tasks/:id** - Delete a task

## Features

- **Secure Authentication:** Uses JWT for user authentication.
- **Task Management:** Supports CRUD operations.
- **Real-time Updates:** Uses WebSockets for live task updates.
- **Cross-Origin Support:** Configured with CORS for secure API access.
