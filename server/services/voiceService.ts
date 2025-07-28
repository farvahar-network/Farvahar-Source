import { readFileSync, writeFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VOICE_ROOMS_FILE = path.join(__dirname, "../data/voice_rooms.json")

interface VoiceRoom {
  channelId: string
  serverId: string
  members: Array<{
    userId: string
    username: string
    joinedAt: string
    muted: boolean
    deafened: boolean
  }>
}

export class VoiceService {
  private static getVoiceRooms(): VoiceRoom[] {
    if (!existsSync(VOICE_ROOMS_FILE)) {
      writeFileSync(VOICE_ROOMS_FILE, JSON.stringify([]))
      return []
    }

    const data = readFileSync(VOICE_ROOMS_FILE, "utf-8")
    return JSON.parse(data)
  }

  private static saveVoiceRooms(rooms: VoiceRoom[]): void {
    writeFileSync(VOICE_ROOMS_FILE, JSON.stringify(rooms, null, 2))
  }

  static async joinVoiceChannel(userId: string, channelId: string, serverId: string): Promise<void> {
    const rooms = this.getVoiceRooms()
    let room = rooms.find((r) => r.channelId === channelId)

    if (!room) {
      room = {
        channelId,
        serverId,
        members: [],
      }
      rooms.push(room)
    }

    // Remove user from other voice channels in the same server
    rooms.forEach((r) => {
      if (r.serverId === serverId && r.channelId !== channelId) {
        r.members = r.members.filter((m) => m.userId !== userId)
      }
    })

    // Add user to the voice channel if not already present
    if (!room.members.find((m) => m.userId === userId)) {
      room.members.push({
        userId,
        username: "", // Will be populated from user service
        joinedAt: new Date().toISOString(),
        muted: false,
        deafened: false,
      })
    }

    this.saveVoiceRooms(rooms)
  }

  static async leaveVoiceChannel(userId: string, channelId: string): Promise<void> {
    const rooms = this.getVoiceRooms()
    const room = rooms.find((r) => r.channelId === channelId)

    if (room) {
      room.members = room.members.filter((m) => m.userId !== userId)

      // Remove empty rooms
      if (room.members.length === 0) {
        const roomIndex = rooms.indexOf(room)
        rooms.splice(roomIndex, 1)
      }
    }

    this.saveVoiceRooms(rooms)
  }

  static async getVoiceChannelMembers(channelId: string): Promise<VoiceRoom["members"]> {
    const rooms = this.getVoiceRooms()
    const room = rooms.find((r) => r.channelId === channelId)
    return room ? room.members : []
  }

  static async getUserVoiceChannels(userId: string): Promise<string[]> {
    const rooms = this.getVoiceRooms()
    return rooms.filter((room) => room.members.some((m) => m.userId === userId)).map((room) => room.channelId)
  }

  static async updateMemberState(
    userId: string,
    channelId: string,
    updates: { muted?: boolean; deafened?: boolean },
  ): Promise<void> {
    const rooms = this.getVoiceRooms()
    const room = rooms.find((r) => r.channelId === channelId)

    if (room) {
      const member = room.members.find((m) => m.userId === userId)
      if (member) {
        if (updates.muted !== undefined) member.muted = updates.muted
        if (updates.deafened !== undefined) member.deafened = updates.deafened
        this.saveVoiceRooms(rooms)
      }
    }
  }
}
