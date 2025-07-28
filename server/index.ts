import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"
import path from "path"
import { fileURLToPath } from "url"

// Import routes
import { authRouter } from "./routes/auth.js"
import { userRouter } from "./routes/users.js"
import { serverRouter } from "./routes/servers.js"
import { uploadRouter } from "./routes/upload.js"
import { messageRouter } from "./routes/messages.js"

// Import middleware
import { authenticateSocket } from "./middleware/auth.js"
import { errorHandler } from "./middleware/errorHandler.js"

// Import socket handlers
import { handleSocketConnection } from "./controllers/socketController.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        mediaSrc: ["'self'", "blob:"],
      },
    },
  }),
)

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
)

app.use(cookieParser())
app.use(express.json({ limit: "500mb" }))
app.use(express.urlencoded({ extended: true, limit: "500mb" }))

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

const messageLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10, // 10 messages per 10 seconds
  message: { error: "Too many messages, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
})

// Apply rate limiting
app.use("/api/auth", authLimiter)
app.use("/api/messages", messageLimiter)

// Static files (CDN)
app.use("/cdn", express.static(path.join(__dirname, "../uploads")))

// API Routes
app.use("/api/auth", authRouter)
app.use("/api/users", userRouter)
app.use("/api/servers", serverRouter)
app.use("/api/upload", uploadRouter)
app.use("/api/messages", messageRouter)

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Socket.IO authentication middleware
io.use(authenticateSocket)

// Socket.IO connection handling
io.on("connection", (socket) => {
  handleSocketConnection(io, socket)
})

// Error handling middleware
app.use(errorHandler)

// Serve React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")))
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"))
  })
}

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 FarvaharCord server running on port ${PORT}`)
  console.log(`📱 Client URL: ${process.env.CLIENT_URL || "http://localhost:5173"}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
  })
})
