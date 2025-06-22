import { ExtendedWSS, messageTypes } from '../poker.types'
import prisma from '../../../config/prisma'
import WebSocket, { Server as WebSocketServer } from 'ws'
import type { User, Room } from '@prisma/client'

export const votePoker = async (
  user: { id: string; name: string; points?: string },
  room: { id: string },
  ws: WebSocket,
  wss: ExtendedWSS
): Promise<{ user: User; room: Room } | { error: string }> => {
  try {
    // 1. Jeśli brak punktów – zignoruj
    if (!user.points) {
      return { user, room } as any
    }

    // 2. Zapisz punkty użytkownika
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { points: user.points }
    })

    // 3. Pobierz pokój z relacjami
    const fRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        users: true,
        tasks: true,
        votes: true,
        messages: true
      }
    })

    if (!fRoom) {
      return { error: 'Room not found' }
    }

    const userIdsInRoom = fRoom.users.map((u) => u.id)

    // 4. Broadcast do użytkowników pokoju
    for (const u of wss.users) {
      if (userIdsInRoom.includes(u.id)) {
        u.ws.send(`${user.name} has voted`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: fRoom.id,
              name: fRoom.name,
              revealed: fRoom.revealed,
              points: fRoom.points,
              tasks: fRoom.tasks,
              users: fRoom.users,
              votes: fRoom.votes,
              messages: fRoom.messages,
              createdAt: fRoom.createdAt
            }
          })
        )
      }
    }

    return { user: updatedUser, room: fRoom }

  } catch (error) {
    console.error('[VOTE_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Error submitting points'
      })
    )
    return { error: 'DB error' }
  }
}
