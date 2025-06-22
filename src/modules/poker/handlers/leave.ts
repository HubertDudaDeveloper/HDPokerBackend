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

export const leavePoker = async (
  user: UserInput,
  room: RoomInput,
  ws: ExtendedWebSocket,
  wss: ExtendedWSS
): Promise<{ user: UserInput; room: Room } | { error: string }> => {
  try {

    if (!room.id) {
      return { error: 'Missing room ID' }
    }

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

    // 2. Usuń użytkownika z bazy
    await prisma.user.delete({
      where: { id: user.id },
    })

    // 3. Usuń użytkownika z WebSocketów
    wss.users = wss.users.filter((u) => u.id !== user.id)

    const updatedUsers = fRoom.users.filter((u) => u.id !== user.id)
    const remainingUserIds = updatedUsers.map((u) => u.id)

    // 4. Broadcast do pozostałych użytkowników
    for (const u of wss.users) {
      if (u.id && remainingUserIds.includes(u.id)) {
        u.ws.send(`${user.name} has left the room.`)
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: fRoom.id,
              name: fRoom.name,
              points: fRoom.points,
              users: updatedUsers,
              tasks: fRoom.tasks,
              votes: fRoom.votes,
              messages: fRoom.messages,
              revealed: fRoom.revealed,
              createdAt: fRoom.createdAt,
            },
          })
        )
      }
    }

    // 5. Potwierdzenie do opuszczającego użytkownika
    ws.send(JSON.stringify({ type: messageTypes.LEAVE }))

    return { user, room: fRoom }
  } catch (error) {
    console.error('[LEAVE_POKER] Error:', error)
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: 'Error leaving room',
      })
    )
    return { error: 'DB error' }
  }
}
