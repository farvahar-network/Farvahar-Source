import { readFileSync, writeFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { generateId } from "../utils/helpers.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const USERS_FILE = path.join(__dirname, "../data/users.json")

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  passwordHash: string
  avatar?: string
  status: "online" | "idle" | "dnd" | "offline"
  aboutMe: string
  pronouns: string
  badges: string[]
  joinedAt: string
  lastSeen: string
  servers: string[]
  friends: string[]
  blockedUsers: string[]
  settings: {
    theme: "light" | "dark"
    notifications: boolean
    soundEnabled: boolean
    compactMode: boolean
  }
}

export class UserService {
  private static getUsers(): User[] {
    if (!existsSync(USERS_FILE)) {
      writeFileSync(USERS_FILE, JSON.stringify([]))
      return []
    }

    try {
      const data = readFileSync(USERS_FILE, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      console.error("Error reading users file:", error)
      return []
    }
  }

  private static saveUsers(users: User[]): void {
    try {
      writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
    } catch (error) {
      console.error("Error saving users:", error)
      throw new Error("Failed to save users")
    }
  }

  static async createUser(
    userData: Omit<User, "id" | "servers" | "friends" | "blockedUsers" | "settings" | "lastSeen">,
  ): Promise<User> {
    const users = this.getUsers()

    const user: User = {
      ...userData,
      id: generateId("usr"),
      servers: [],
      friends: [],
      blockedUsers: [],
      lastSeen: new Date().toISOString(),
      settings: {
        theme: "dark",
        notifications: true,
        soundEnabled: true,
        compactMode: false,
      },
    }

    users.push(user)
    this.saveUsers(users)

    return user
  }

  static async findById(id: string): Promise<User | null> {
    const users = this.getUsers()
    return users.find((user) => user.id === id) || null
  }

  static async findByEmail(email: string): Promise<User | null> {
    const users = this.getUsers()
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null
  }

  static async findByUsername(username: string): Promise<User | null> {
    const users = this.getUsers()
    return users.find((user) => user.username.toLowerCase() === username.toLowerCase()) || null
  }

  static async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === id)

    if (userIndex === -1) return null

    users[userIndex] = { ...users[userIndex], ...updates }
    this.saveUsers(users)

    return users[userIndex]
  }

  static async updateUserStatus(id: string, status: User["status"]): Promise<void> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === id)

    if (userIndex !== -1) {
      users[userIndex].status = status
      users[userIndex].lastSeen = new Date().toISOString()
      this.saveUsers(users)
    }
  }

  static async updateAvatar(id: string, avatarUrl: string): Promise<User | null> {
    return this.updateUser(id, { avatar: avatarUrl })
  }

  static async getUserServers(userId: string): Promise<string[]> {
    const user = await this.findById(userId)
    return user?.servers || []
  }

  static async addUserToServer(userId: string, serverId: string): Promise<void> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === userId)

    if (userIndex !== -1 && !users[userIndex].servers.includes(serverId)) {
      users[userIndex].servers.push(serverId)
      this.saveUsers(users)
    }
  }

  static async removeUserFromServer(userId: string, serverId: string): Promise<void> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === userId)

    if (userIndex !== -1) {
      users[userIndex].servers = users[userIndex].servers.filter((id) => id !== serverId)
      this.saveUsers(users)
    }
  }

  static async searchUsers(query: string, limit = 10): Promise<Omit<User, "passwordHash" | "email">[]> {
    const users = this.getUsers()
    const searchResults = users.filter(
      (user) =>
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.displayName.toLowerCase().includes(query.toLowerCase()),
    )

    return searchResults.slice(0, limit).map((user) => {
      const { passwordHash, email, ...safeUser } = user
      return safeUser
    })
  }

  static async addFriend(userId: string, friendId: string): Promise<void> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === userId)
    const friendIndex = users.findIndex((user) => user.id === friendId)

    if (userIndex !== -1 && friendIndex !== -1) {
      if (!users[userIndex].friends.includes(friendId)) {
        users[userIndex].friends.push(friendId)
      }
      if (!users[friendIndex].friends.includes(userId)) {
        users[friendIndex].friends.push(userId)
      }
      this.saveUsers(users)
    }
  }

  static async removeFriend(userId: string, friendId: string): Promise<void> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === userId)
    const friendIndex = users.findIndex((user) => user.id === friendId)

    if (userIndex !== -1) {
      users[userIndex].friends = users[userIndex].friends.filter((id) => id !== friendId)
    }
    if (friendIndex !== -1) {
      users[friendIndex].friends = users[friendIndex].friends.filter((id) => id !== userId)
    }

    this.saveUsers(users)
  }

  static async blockUser(userId: string, blockedUserId: string): Promise<void> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === userId)

    if (userIndex !== -1 && !users[userIndex].blockedUsers.includes(blockedUserId)) {
      users[userIndex].blockedUsers.push(blockedUserId)
      // Remove from friends if they were friends
      users[userIndex].friends = users[userIndex].friends.filter((id) => id !== blockedUserId)
      this.saveUsers(users)
    }
  }

  static async unblockUser(userId: string, blockedUserId: string): Promise<void> {
    const users = this.getUsers()
    const userIndex = users.findIndex((user) => user.id === userId)

    if (userIndex !== -1) {
      users[userIndex].blockedUsers = users[userIndex].blockedUsers.filter((id) => id !== blockedUserId)
      this.saveUsers(users)
    }
  }
}
