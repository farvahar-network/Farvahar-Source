import { Router } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { UserService } from "../services/userService.js"
import { validateInput } from "../middleware/validation.js"

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret"

router.post("/register", validateInput, async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body

    const existingUser = await UserService.findByEmail(email)
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" })
    }

    const existingUsername = await UserService.findByUsername(username)
    if (existingUsername) {
      return res.status(400).json({ error: "Username already taken" })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await UserService.createUser({
      username,
      email,
      displayName: displayName || username,
      passwordHash,
      avatar: null,
      status: "online",
      aboutMe: "",
      pronouns: "",
      badges: [],
      joinedAt: new Date().toISOString(),
    })

    const accessToken = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "15m" })

    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" })

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000,
    })

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.post("/login", validateInput, async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await UserService.findByEmail(email)
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const accessToken = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "15m" })

    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" })

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000,
    })

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    await UserService.updateUserStatus(user.id, "online")

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        status: "online",
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.post("/refresh", (req, res) => {
  try {
    const { refreshToken } = req.cookies

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" })
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err: any, decoded: any) => {
      if (err) {
        return res.status(401).json({ error: "Invalid refresh token" })
      }

      const user = await UserService.findById(decoded.userId)
      if (!user) {
        return res.status(401).json({ error: "User not found" })
      }

      const accessToken = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "15m" })

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 15 * 60 * 1000,
      })

      res.json({ success: true })
    })
  } catch (error) {
    console.error("Refresh error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.post("/logout", (req, res) => {
  res.clearCookie("accessToken")
  res.clearCookie("refreshToken")
  res.json({ success: true })
})

export { router as authRouter }
