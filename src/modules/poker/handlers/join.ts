import { ExtendedWSS, messageTypes } from '../poker.types'
import prisma from '../../../config/prisma'
import WebSocket, { Server as WebSocketServer } from 'ws'
import type { Room, User } from '@prisma/client'

interface UserInput {
  id?: string
  name: string
}

interface RoomInput {
  name: string
}

interface ExtendedWebSocket extends WebSocket {
  id?: string
  roomId?: string
}

export const joinPoker = async (
  user: UserInput,
  room: RoomInput,
  ws: ExtendedWebSocket,
  wss: ExtendedWSS
): Promise<
  | {
      user: User & { ws: WebSocket }
      room: Room & { users: User[] }
    }
  | void
> => {
  try {
    // 1. Sprawdź, czy pokój istnieje
    const foundRoom = await prisma.room.findUnique({
      where: { name: room.name },
      include: { users: true }
    })

    if (!foundRoom) {
      ws.send(
        JSON.stringify({
          type: messageTypes.ERROR,
          message: 'Room does not exist',
          code: 404
        })
      )
      return
    }

    // 2. Stwórz użytkownika
    const createdUser = await prisma.user.create({
      data: {
        name: user.name,
        roomId: foundRoom.id
      }
    })

    // 3. Broadcast do użytkowników z pokoju
    const userIdsInRoom = foundRoom.users.map((u) => u.id)
    wss.users.push({ ...createdUser, ws })

    for (const u of wss.users) {
      if (userIdsInRoom.includes(u.id!)) {
        u.ws.send(`${user.name} has joined the room`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: foundRoom.id,
              name: foundRoom.name,
              password: foundRoom.password,
              revealed: foundRoom.revealed,
              createdAt: foundRoom.createdAt
            }
          })
        )
      }
    }

    // 4. Potwierdzenie do nowego użytkownika
    ws.send(
      JSON.stringify({
        type: messageTypes.JOIN,
        user: createdUser,
        room: foundRoom
      })
    )

    return {
      user: { ...createdUser, ws },
      room: foundRoom
    }

  } catch (error) {
    console.error('[JOIN_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Error joining room'
      })
    )
  }
}
