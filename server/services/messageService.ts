import { readFileSync, writeFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { generateId } from "../utils/helpers.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MESSAGES_FILE = path.join(__dirname, "../data/messages.json")

export interface Message {
  id: string
  channelId: string
  serverId: string
  authorId: string
  content: string
  timestamp: string
  edited?: string
  reactions: Record<string, string[]> // emoji -> userIds
  attachments: Array<{
    id: string
    filename: string
    url: string
    size: number
    type: string
  }>
  mentions?: string[]
  replyTo?: string
}

export class MessageService {
  private static getMessages(): Message[] {
    if (!existsSync(MESSAGES_FILE)) {
      writeFileSync(MESSAGES_FILE, JSON.stringify([]))
      return []
    }

    try {
      const data = readFileSync(MESSAGES_FILE, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      console.error("Error reading messages file:", error)
      return []
    }
  }

  private static saveMessages(messages: Message[]): void {
    try {
      writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2))
    } catch (error) {
      console.error("Error saving messages:", error)
      throw new Error("Failed to save messages")
    }
  }

  static async createMessage(messageData: Omit<Message, "id" | "reactions" | "mentions">): Promise<Message> {
    const messages = this.getMessages()

    // Extract mentions from content
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(messageData.content)) !== null) {
      mentions.push(match[1])
    }

    const message: Message = {
      ...messageData,
      id: generateId("msg"),
      reactions: {},
      mentions,
    }

    messages.push(message)
    this.saveMessages(messages)

    return message
  }

  static async getChannelMessages(channelId: string, limit = 50, before?: string): Promise<Message[]> {
    const messages = this.getMessages()
    let channelMessages = messages.filter((msg) => msg.channelId === channelId)

    // If before timestamp is provided, filter messages
    if (before) {
      channelMessages = channelMessages.filter((msg) => new Date(msg.timestamp) < new Date(before))
    }

    return channelMessages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .reverse()
  }

  static async addReaction(messageId: string, userId: string, emoji: string): Promise<Message | null> {
    const messages = this.getMessages()
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)

    if (messageIndex === -1) return null

    const message = messages[messageIndex]

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = []
    }

    if (!message.reactions[emoji].includes(userId)) {
      message.reactions[emoji].push(userId)
    }

    this.saveMessages(messages)
    return message
  }

  static async removeReaction(messageId: string, userId: string, emoji: string): Promise<Message | null> {
    const messages = this.getMessages()
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)

    if (messageIndex === -1) return null

    const message = messages[messageIndex]

    if (message.reactions[emoji]) {
      message.reactions[emoji] = message.reactions[emoji].filter((id) => id !== userId)

      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji]
      }
    }

    this.saveMessages(messages)
    return message
  }

  static async editMessage(messageId: string, userId: string, newContent: string): Promise<Message | null> {
    const messages = this.getMessages()
    const messageIndex = messages.findIndex((msg) => msg.id === messageId && msg.authorId === userId)

    if (messageIndex === -1) return null

    messages[messageIndex].content = newContent
    messages[messageIndex].edited = new Date().toISOString()

    // Update mentions
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(newContent)) !== null) {
      mentions.push(match[1])
    }
    messages[messageIndex].mentions = mentions

    this.saveMessages(messages)
    return messages[messageIndex]
  }

  static async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const messages = this.getMessages()
    const messageIndex = messages.findIndex((msg) => msg.id === messageId && msg.authorId === userId)

    if (messageIndex === -1) return false

    messages.splice(messageIndex, 1)
    this.saveMessages(messages)
    return true
  }

  static async searchMessages(serverId: string, query: string, channelId?: string, limit = 25): Promise<Message[]> {
    const messages = this.getMessages()
    let filteredMessages = messages.filter((msg) => msg.serverId === serverId)

    if (channelId) {
      filteredMessages = filteredMessages.filter((msg) => msg.channelId === channelId)
    }

    const searchResults = filteredMessages.filter((msg) => msg.content.toLowerCase().includes(query.toLowerCase()))

    return searchResults
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }
}
