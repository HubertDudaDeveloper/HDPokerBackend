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
    // 1. Sprawdź czy pokój istnieje
    const fRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: { users: true }
    })

    if (!fRoom) {
      return { error: 'Room not found' }
    }

    // 2. Ustal nowy stan "revealed"
    const newRevealedState = !fRoom.revealed

    // 3. Zaktualizuj pokój
    await prisma.room.update({
      where: { id: room.id },
      data: { revealed: newRevealedState }
    })

    // 4. Pobierz pełne dane pokoju ponownie
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

    // 5. Rozgłoś do użytkowników w pokoju
    const userIds = updatedRoom.users.map((u) => u.id)

    for (const u of wss.users) {
      if (u.id && userIds.includes(u.id)) {
        u.ws.send(`${user.name} has ${newRevealedState ? 'revealed' : 'hidden'} the votes`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: updatedRoom.id,
              name: updatedRoom.name,
              revealed: updatedRoom.revealed,
              createdAt: updatedRoom.createdAt,
              points: updatedRoom.points,
              users: updatedRoom.users,
              votes: updatedRoom.votes,
              tasks: updatedRoom.tasks,
              messages: updatedRoom.messages
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
