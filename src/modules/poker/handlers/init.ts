import { User, Room } from "@prisma/client"
import prisma from "../../../config/prisma"
import { ExtendedWebSocket, ExtendedWSS, messageTypes } from "../poker.types"
import type WS from "ws";

interface UserInput {
  image: string | null
  id?: string
  name: string
}

interface RoomInput {
  name: string,
  password: string
}

export const initPoker = async (
  user: UserInput,
  room: RoomInput,
  ws: ExtendedWebSocket,
  wss: ExtendedWSS
): Promise<{
  user: User & { ws: WebSocket },
  room: Room & { users: User[] }
} | void> => {
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
            name: user.name,
            image: user.image
          }
        }
      },
      include: {
        users: true,
        tasks: true,
        votes: true,
        messages: true
      }
    })

    createdUser = createdRoom.users[0]

    // 2. Dodaj użytkownika do połączeń WebSocket
    const wsUser = {
      id: createdUser.id,
      roomId: createdRoom.id,
      name: createdUser.name,
      image: createdUser.image,
      ws
    }

    wss.users.push(wsUser)

    // 3. Broadcast do innych użytkowników w pokoju (w tym przypadku tylko host)
    for (const u of wss.users) {
      if (u.roomId === createdRoom.id && u.id !== createdUser.id) {
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: createdRoom
          })
        )
      }
    }

    // 4. Wyślij dane do klienta (hosta)
    ws.send(
      JSON.stringify({
        type: messageTypes.INIT,
        user: createdUser,
        room: createdRoom
      })
    )

    // 5. Zwróć dane do dalszego użytku
    return {
      user: Object.assign({}, createdUser, { ws }) as any,
      room: createdRoom
    }
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
}
