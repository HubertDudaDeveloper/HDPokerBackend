import { messageTypes, ExtendedWSS } from '../poker.types'
import prisma from '../../../config/prisma'
import WebSocket from 'ws'

interface UserInput {
  id: string
  name: string
  vote: string
}

interface RoomInput {
  id: string
}

export const updatePoker = async (
  user: UserInput,
  room: RoomInput,
  ws: WebSocket,
  wss: ExtendedWSS
) => {
  try {
    // 1. Zapisz głos użytkownika
    await prisma.user.update({
      where: { id: user.id },
      data: { vote: user.vote }
    })

    // 2. Pobierz pełny stan pokoju po aktualizacji
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
      return { error: 'Room not found' }
    }

    const userIds = updatedRoom.users.map((u) => u.id)

    // 3. Broadcast do użytkowników w pokoju
    for (const u of wss.users) {
      if (userIds.includes(u.id)) {
        u.ws.send(`${user.name} has voted`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: updatedRoom
          })
        )
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        vote: user.vote
      },
      room: updatedRoom
    }

  } catch (error) {
    console.error('[UPDATE_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Error submitting vote'
      })
    )
    return { error: 'DB error' }
  }
}
