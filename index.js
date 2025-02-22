const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(
  cors({
    origin: "https://task-sorter-by-ashraf.web.app",
    credentials: true,
  })
);
app.use(express.json());

// WebSocket connection
wss.on("connection", (ws) => {
  // console.log("Client connected");

  ws.on("close", () => {
    // console.log("Client disconnected");
  });
});

// Function to broadcast messages to all connected clients
const broadcast = (message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

// const uri = `mongodb://localhost:27017/?appName=task-sorter`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@main.h0ug1.mongodb.net/?retryWrites=true&w=majority&appName=main`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const taskSorterDB = client.db("task-sorter");
    const taskCollection = taskSorterDB.collection("tasks");
    const usersCollection = taskSorterDB.collection("users");

    app.get("/", (req, res) => {
      res.send("Task Sorter API Running");
    });

    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "3h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    app.post("/users", async (req, res) => {
      const userCredential = req.body;
      const userEmail = req.body.email;
      const filter = { email: userEmail };
      const oldUser = await usersCollection.findOne(filter);

      if (!oldUser) {
        const result = await usersCollection.insertOne({
          ...userCredential,
          userCreated: new Date().toISOString(),
        });
        res.send(result);
        return;
      } else {
        const updateResult = await usersCollection.updateOne(filter, {
          $set: { lastSignIn: userCredential.lastSignIn },
        });
        res.send(updateResult);
      }
    });

    app.get("/tasks/:userId", verifyToken, async (req, res) => {
      const userId = req.params.userId;
      const tasks = await taskCollection.find({ userId: userId }).toArray();
      res.send(tasks);
    });

    app.post("/tasks", verifyToken, async (req, res) => {
      const taskData = req.body;

      if (!taskData.title || !taskData.category || !taskData.userId) {
        return res.status(400).send({ message: "Missing required fields" });
      }

      try {
        const lastTask = await taskCollection
          .find({ category: taskData.category, userId: taskData.userId })
          .sort({ orderIndex: -1 })
          .limit(1)
          .toArray();

        const nextOrderIndex =
          lastTask.length > 0 ? lastTask[0].orderIndex + 1 : 0;

        const newTask = { ...taskData, orderIndex: nextOrderIndex };

        const result = await taskCollection.insertOne(newTask);

        // Broadcast new task to all connected clients
        broadcast({ type: "TASK_ADDED", payload: newTask });

        res.send(result);
      } catch (error) {
        console.error("Error adding task:", error);
        res.status(500).send({ message: "Failed to add task" });
      }
    });

    app.put("/edit-task/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid task ID" });
        }
        const updatedTask = req.body;
        const {
          title,
          category,
          userId,
          description,
          timestamp,
          email,
          orderIndex,
          dueDate,
        } = updatedTask;

        const result = await taskCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              title,
              category,
              userId,
              description,
              timestamp,
              email,
              orderIndex,
              dueDate,
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Task not found" });
        }

        // Broadcast updated task
        broadcast({ type: "TASK_UPDATED", payload: updatedTask });

        res.send({ success: true, message: "Task updated successfully!" });
      } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.delete("/tasks/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      try {
        const task = await taskCollection.findOne({ _id: new ObjectId(id) });

        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        const result = await taskCollection.deleteOne({
          _id: new ObjectId(id),
        });

        // Broadcast deleted task
        broadcast({ type: "TASK_DELETED", payload: id });

        res.send(result);
      } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.put("/tasks/reorder", verifyToken, async (req, res) => {
      const { tasks } = req.body;

      if (!tasks || !Array.isArray(tasks)) {
        return res.status(400).json({ message: "Invalid task data" });
      }

      try {
        const bulkOps = tasks.map((task) => ({
          updateOne: {
            filter: { _id: new ObjectId(task._id) },
            update: {
              $set: { orderIndex: task.orderIndex, category: task.category },
            },
          },
        }));

        await taskCollection.bulkWrite(bulkOps);

        // Broadcast updated tasks if using WebSockets
        broadcast({ type: "TASKS_REORDERED", payload: tasks });

        res.send({ success: true });
      } catch (error) {
        console.error("Reordering error:", error);
        res.status(500).json({ message: "Failed to reorder tasks" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    // console.log("Connected to MongoDB!");
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

server.listen(port, () => {
  // console.log(`Server is running on http://localhost:${port}`);
});
