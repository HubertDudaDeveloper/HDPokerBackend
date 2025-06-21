import { ExtendedWSS, messageTypes } from '../poker.types'
import prisma from '../../../config/prisma'
import WebSocket, { Server as WebSocketServer } from 'ws'
import type { User, Room } from '@prisma/client'

interface UserInput {
  id: string
  name: string
}

interface RoomInput {
  id: string
}

interface ExtendedWebSocket extends WebSocket {
  id?: string
  roomId?: string
}

export const resetPoker = async (
  user: UserInput,
  room: RoomInput,
  ws: ExtendedWebSocket,
  wss: ExtendedWSS
): Promise<
  | { user: UserInput; room: Room }
  | { error: string }
> => {
  try {
    // 1. Pobierz pokój z użytkownikami
    const fRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: { users: true }
    })

    if (!fRoom) {
      return { error: 'Room not found' }
    }

    const userIds = fRoom.users.map((u) => u.id)

    // 2. Zresetuj głosy użytkowników
    await prisma.user.updateMany({
      where: {
        roomId: room.id
      },
      data: {
        vote: null
      }
    })

    // 3. Broadcast do użytkowników
    for (const u of wss.users) {
      if (userIds.includes(u.id!)) {
        u.ws.send(`${user.name} has reset the votes`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: fRoom.id,
              name: fRoom.name,
              revealed: fRoom.revealed,
              createdAt: fRoom.createdAt
            }
          })
        )
      }
    }

    return { user, room: fRoom }

  } catch (error) {
    console.error('[RESET_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Error resetting votes'
      })
    )
    return { error: 'DB error' }
  }
}
