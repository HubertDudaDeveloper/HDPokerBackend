import { messageTypes } from '../poker.types'
import prisma from '../../../config/prisma'
import { ExtendedWebSocket, ExtendedWSS } from './../poker.types'
import type { User, Room } from '@prisma/client'

interface UserInput {
  id: string
  name: string
}

interface RoomInput {
  id: string
}

export const revealPoker = async (
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

    const newRevealedState = !fRoom.revealed

    // 2. Zaktualizuj flagę
    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: { revealed: newRevealedState },
      include: { users: true }
    })

    const userIds = updatedRoom.users.map((u) => u.id)

    // 3. Broadcast do użytkowników
    for (const u of wss.users) {
      if (userIds.includes(u.id!)) {
        u.ws.send(`${user.name} has ${newRevealedState ? 'revealed' : 'hidden'} the votes`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: updatedRoom.id,
              name: updatedRoom.name,
              revealed: updatedRoom.revealed,
              createdAt: updatedRoom.createdAt
            }
          })
        )
      }
    }

    return { user, room: updatedRoom }

  } catch (error) {
    console.error('[REVEAL_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Error toggling vote visibility'
      })
    )
    return { error: 'DB error' }
  }
}
