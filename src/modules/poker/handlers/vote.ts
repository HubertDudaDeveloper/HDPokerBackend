import { messageTypes } from '../poker.types'
import prisma from '../../../config/prisma'
import WebSocket, { Server as WebSocketServer } from 'ws'

export const votePoker = async (
  user: { id: string; name: string; vote?: string },
  room: { id: string },
  ws: WebSocket,
  wss: WebSocketServer & { users: any[] }
) => {
  try {
    // 1. Jeśli brak głosu – zignoruj
    if (!user.vote) {
      return { user, room }
    }

    // 2. Zapisz głos użytkownika w bazie
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { vote: user.vote }
    })

    // 3. Pobierz pokój z użytkownikami
    const fRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: { users: true }
    })

    if (!fRoom) {
      return { error: 'Room not found' }
    }

    const userIds = fRoom.users.map((u) => u.id)

    // 4. Broadcast do użytkowników pokoju
    for (const u of wss.users) {
      if (userIds.includes(u.id)) {
        u.ws.send(`${user.name} has voted`)
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

    return { user: updatedUser, room: fRoom }

  } catch (error) {
    console.error('[VOTE_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Error submitting vote'
      })
    )
    return { error: 'DB error' }
  }
}
