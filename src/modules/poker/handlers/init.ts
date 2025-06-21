import { ExtendedWSS, messageTypes } from '../poker.types'
import prisma from '../../../config/prisma'
import WebSocket, { Server as WebSocketServer } from 'ws'
import type { Room, User } from '@prisma/client'

interface UserInput {
  name: string
}

interface RoomInput {
  name: string
  password?: string
}

interface ExtendedWebSocket extends WebSocket {
  id?: string
  roomId?: string
}

export const initPoker = async (
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
  let createdUser: User | null = null
  let createdRoom: (Room & { users: User[] }) | null = null

  try {
    // 1. Stwórz pokój z użytkownikiem
    createdRoom = await prisma.room.create({
      data: {
        name: room.name,
        password: room.password ?? null,
        revealed: false,
        users: {
          create: {
            name: user.name
          }
        }
      },
      include: {
        users: true
      }
    })

    createdUser = createdRoom.users[0]
  } catch (error) {
    console.error('[INIT_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Nie udało się utworzyć pokoju lub użytkownika.'
      })
    )
    return
  }

  // 2. Wyślij dane do klienta
  ws.send(
    JSON.stringify({
      type: messageTypes.INIT,
      user: createdUser,
      room: {
        id: createdRoom.id,
        name: createdRoom.name,
        password: createdRoom.password,
        revealed: createdRoom.revealed,
        createdAt: createdRoom.createdAt
      }
    })
  )

  // 3. Zwróć dane do dalszego użytku
  return {
    user: { ...createdUser, ws },
    room: createdRoom
  }
}
