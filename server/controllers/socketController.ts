import type { Server, Socket } from "socket.io"
import { MessageService } from "../services/messageService.js"
import { VoiceService } from "../services/voiceService.js"
import { UserService } from "../services/userService.js"
import { validateMessage } from "../utils/validation.js"
import { sanitizeInput } from "../utils/sanitization.js"

interface AuthenticatedSocket extends Socket {
  userId: string
  username: string
}

export function handleSocketConnection(io: Server, socket: AuthenticatedSocket) {
  console.log(`User ${socket.username} (${socket.userId}) connected`)

  UserService.updateUserStatus(socket.userId, "online")

  const userServers = UserService.getUserServers(socket.userId)
  userServers.forEach((serverId) => {
    socket.join(`server:${serverId}`)
  })

  socket.on("join-channel", (data: { channelId: string; serverId: string }) => {
    const { channelId, serverId } = data

    if (!userServers.includes(serverId)) {
      socket.emit("error", { message: "Access denied to this server" })
      return
    }

    socket.join(`channel:${channelId}`)
    console.log(`${socket.username} joined channel ${channelId}`)

    socket.to(`channel:${channelId}`).emit("user-joined-channel", {
      userId: socket.userId,
      username: socket.username,
    })
  })

  socket.on("leave-channel", (channelId: string) => {
    socket.leave(`channel:${channelId}`)
    socket.to(`channel:${channelId}`).emit("user-left-channel", {
      userId: socket.userId,
    })
  })

  socket.on(
    "send-message",
    async (data: {
      channelId: string
      content: string
      serverId: string
      attachments?: Array<{ id: string; filename: string; url: string; size: number; type: string }>
    }) => {
      try {
        const validation = validateMessage(data.content)
        if (!validation.success) {
          socket.emit("error", { message: "Invalid message content" })
          return
        }

        const sanitizedContent = sanitizeInput(data.content)

          socket.emit("error", { message: "Access denied to this server" })
          return
        }

        const message = await MessageService.createMessage({
          channelId: data.channelId,
          serverId: data.serverId,
          authorId: socket.userId,
          content: sanitizedContent,
          timestamp: new Date().toISOString(),
          attachments: data.attachments || [],
        })

        const author = await UserService.findById(socket.userId)
        const messageWithAuthor = {
          ...message,
          author: {
            id: author?.id,
            username: author?.username,
            displayName: author?.displayName,
            avatar: author?.avatar,
          },
        }

        io.to(`channel:${data.channelId}`).emit("new-message", messageWithAuthor)
      } catch (error) {
        console.error("Send message error:", error)
        socket.emit("error", { message: "Failed to send message" })
      }
    },
  )

  socket.on("typing-start", (channelId: string) => {
    socket.to(`channel:${channelId}`).emit("user-typing", {
      userId: socket.userId,
      username: socket.username,
      channelId,
    })
  })

  socket.on("typing-stop", (channelId: string) => {
    socket.to(`channel:${channelId}`).emit("user-stop-typing", {
      userId: socket.userId,
      channelId,
    })
  })

  socket.on(
    "add-reaction",
    async (data: {
      messageId: string
      emoji: string
      channelId: string
    }) => {
      try {
        const updatedMessage = await MessageService.addReaction(data.messageId, socket.userId, data.emoji)

        if (updatedMessage) {
          io.to(`channel:${data.channelId}`).emit("message-updated", updatedMessage)
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to add reaction" })
      }
    },
  )

  socket.on(
    "remove-reaction",
    async (data: {
      messageId: string
      emoji: string
      channelId: string
    }) => {
      try {
        const updatedMessage = await MessageService.removeReaction(data.messageId, socket.userId, data.emoji)

        if (updatedMessage) {
          io.to(`channel:${data.channelId}`).emit("message-updated", updatedMessage)
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to remove reaction" })
      }
    },
  )

  // Handle message editing
  socket.on(
    "edit-message",
    async (data: {
      messageId: string
      content: string
      channelId: string
    }) => {
      try {
        const sanitizedContent = sanitizeInput(data.content)
        const updatedMessage = await MessageService.editMessage(data.messageId, socket.userId, sanitizedContent)

        if (updatedMessage) {
          io.to(`channel:${data.channelId}`).emit("message-updated", updatedMessage)
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to edit message" })
      }
    },
  )

  socket.on(
    "delete-message",
    async (data: {
      messageId: string
      channelId: string
    }) => {
      try {
        const success = await MessageService.deleteMessage(data.messageId, socket.userId)

        if (success) {
          io.to(`channel:${data.channelId}`).emit("message-deleted", {
            messageId: data.messageId,
          })
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to delete message" })
      }
    },
  )

  socket.on("join-voice", async (data: { channelId: string; serverId: string }) => {
    try {
      if (!userServers.includes(data.serverId)) {
        socket.emit("error", { message: "Access denied to this server" })
        return
      }

      await VoiceService.joinVoiceChannel(socket.userId, data.channelId, data.serverId)
      socket.join(`voice:${data.channelId}`)

      const user = await UserService.findById(socket.userId)

      socket.to(`voice:${data.channelId}`).emit("user-joined-voice", {
        userId: socket.userId,
        username: socket.username,
        displayName: user?.displayName,
        avatar: user?.avatar,
      })

      const members = await VoiceService.getVoiceChannelMembers(data.channelId)
      socket.emit("voice-channel-members", members)
    } catch (error) {
      socket.emit("error", { message: "Failed to join voice channel" })
    }
  })

  socket.on("leave-voice", async (channelId: string) => {
    try {
      await VoiceService.leaveVoiceChannel(socket.userId, channelId)
      socket.leave(`voice:${channelId}`)

      socket.to(`voice:${channelId}`).emit("user-left-voice", {
        userId: socket.userId,
      })
    } catch (error) {
      socket.emit("error", { message: "Failed to leave voice channel" })
    }
  })

  socket.on("webrtc-offer", (data: { to: string; offer: any; channelId: string }) => {
    socket.to(`voice:${data.channelId}`).emit("webrtc-offer", {
      from: socket.userId,
      to: data.to,
      offer: data.offer,
    })
  })

  socket.on("webrtc-answer", (data: { to: string; answer: any; channelId: string }) => {
    socket.to(`voice:${data.channelId}`).emit("webrtc-answer", {
      from: socket.userId,
      to: data.to,
      answer: data.answer,
    })
  })

  socket.on("webrtc-ice-candidate", (data: { to: string; candidate: any; channelId: string }) => {
    socket.to(`voice:${data.channelId}`).emit("webrtc-ice-candidate", {
      from: socket.userId,
      to: data.to,
      candidate: data.candidate,
    })
  })

  socket.on(
    "update-voice-state",
    async (data: {
      channelId: string
      muted?: boolean
      deafened?: boolean
    }) => {
      try {
        await VoiceService.updateMemberState(socket.userId, data.channelId, {
          muted: data.muted,
          deafened: data.deafened,
        })

        socket.to(`voice:${data.channelId}`).emit("voice-state-updated", {
          userId: socket.userId,
          muted: data.muted,
          deafened: data.deafened,
        })
      } catch (error) {
        socket.emit("error", { message: "Failed to update voice state" })
      }
    },
  )

  socket.on("update-status", async (status: "online" | "idle" | "dnd" | "offline") => {
    try {
      await UserService.updateUserStatus(socket.userId, status)

      userServers.forEach((serverId) => {
        socket.to(`server:${serverId}`).emit("user-status-updated", {
          userId: socket.userId,
          status,
        })
      })
    } catch (error) {
      socket.emit("error", { message: "Failed to update status" })
    }
  })

  socket.on("disconnect", async (reason) => {
    console.log(`User ${socket.username} disconnected: ${reason}`)

    await UserService.updateUserStatus(socket.userId, "offline")

    const voiceChannels = await VoiceService.getUserVoiceChannels(socket.userId)
    for (const channelId of voiceChannels) {
      await VoiceService.leaveVoiceChannel(socket.userId, channelId)
      socket.to(`voice:${channelId}`).emit("user-left-voice", {
        userId: socket.userId,
      })
    }

    userServers.forEach((serverId) => {
      socket.to(`server:${serverId}`).emit("user-status-updated", {
        userId: socket.userId,
        status: "offline",
      })
    })
  })
}
