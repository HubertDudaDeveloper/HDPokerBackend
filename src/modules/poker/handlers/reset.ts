import { ExtendedWSS, messageTypes } from '../poker.types'
import prisma from '../../../config/prisma'
import WebSocket from 'ws'
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
    // 1. Sprawdź czy pokój istnieje
    const fRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: { users: true }
    })

    if (!fRoom) {
      return { error: 'Room not found' }
    }

    const userIds = fRoom.users.map((u) => u.id)

    // 2. Reset głosów, punktów i ukrycie wyników
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { roomId: room.id },
        data: {
          vote: null,
          points: '0'
        }
      }),
      prisma.room.update({
        where: { id: room.id },
        data: { revealed: false }
      })
    ])

    // 3. Pobierz zaktualizowany pokój
    const updatedRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        users: true,
        votes: true,
        tasks: true,
        messages: true
      }
    })

    if (!updatedRoom) {
      return { error: 'Updated room not found' }
    }

    // 4. Broadcast do użytkowników w pokoju
    for (const u of wss.users) {
      if (userIds.includes(u.id!)) {
        u.ws.send(`${user.name} has reset the votes`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: updatedRoom
          })
        )
      }
    }

    return { user, room: updatedRoom }

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