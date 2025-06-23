import { ExtendedWSS, messageTypes } from "../poker.types";
import prisma from "../../../config/prisma";
import WebSocket, { Server as WebSocketServer } from "ws";
import type { Room, User, Prisma } from "@prisma/client";

interface UserInput {
  image: string | null;
  id?: string;
  name: string;
}

interface RoomInput {
  name: string;
}

interface ExtendedWebSocket extends WebSocket {
  id?: string;
  roomId?: string;
}

export const joinPoker = async (
  user: UserInput,
  room: RoomInput,
  ws: ExtendedWebSocket,
  wss: ExtendedWSS
): Promise<{
  user: User & { ws: WebSocket };
  room: Prisma.RoomGetPayload<{
    include: {
      users: true;
      tasks: true;
      votes: true;
      messages: true;
    };
  }>;
} | void> => {
  try {
    // 1. Sprawdź, czy pokój istnieje i załaduj relacje
    const foundRoom = await prisma.room.findUnique({
      where: { name: room.name },
      include: {
        users: true,
        tasks: true,
        votes: true,
        messages: true,
      },
    });

    if (!foundRoom) {
      ws.send(
        JSON.stringify({
          type: messageTypes.ERROR,
          message: "Room does not exist",
          code: 404,
        })
      );
      return;
    }

    // 2. Znajdź lub stwórz użytkownika
    let createdUser: User;

    if (user.id) {
      const existingUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!existingUser) {
        createdUser = await prisma.user.create({
          data: {
            id: user.id,
            name: user.name,
            image: user.image,
            roomId: foundRoom.id,
          },
        });
      } else {
        if (existingUser.roomId !== foundRoom.id) {
          createdUser = await prisma.user.update({
            where: { id: user.id },
            data: {
              roomId: foundRoom.id,
              name: user.name,
              image: user.image,
            },
          });
        } else {
          createdUser = existingUser;
        }
      }
    } else {
      createdUser = await prisma.user.create({
        data: {
          name: user.name,
          image: user.image,
          roomId: foundRoom.id,
        },
      });
    }

    // 3. Dodaj użytkownika do pamięci
    wss.users.push({ ...createdUser, ws });

    // 4. Broadcast do pozostałych użytkowników z pokoju
    const userIdsInRoom = foundRoom.users.map((u) => u.id);

    for (const u of wss.users) {
      if (userIdsInRoom.includes(u.id!)) {
        u.ws.send(`${user.name} has joined the room`);
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: foundRoom.id,
              name: foundRoom.name,
              points: foundRoom.points,
              users: [...foundRoom.users, createdUser],
              tasks: foundRoom.tasks,
              votes: foundRoom.votes,
              messages: foundRoom.messages,
              revealed: foundRoom.revealed,
              createdAt: foundRoom.createdAt,
            },
          })
        );
      }
    }

    // 5. Potwierdzenie do nowego użytkownika
    ws.send(
      JSON.stringify({
        type: messageTypes.JOIN,
        user: createdUser,
        room: {
          ...foundRoom,
          users: [...foundRoom.users, createdUser],
        },
      })
    );

    return {
      user: { ...createdUser, ws },
      room: {
        ...foundRoom,
        users: [...foundRoom.users, createdUser],
      },
    };
  } catch (error) {
    console.error("[JOIN_POKER] Error:", error);
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: "Error joining room",
      })
    );
  }
};
