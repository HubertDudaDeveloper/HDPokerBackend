import { ExtendedWSS, messageTypes } from "../poker.types";
import prisma from "../../../config/prisma";
import WebSocket from "ws";
import type { Room, Task, User } from "@prisma/client";

interface TaskInput {
  name: string;
  status: string;
  image?: string | null;
  link?: string | null;
  points?: string | null;
}

interface RoomInput {
  id: string;
  tasks: TaskInput[];
}

interface UserInput {
  id: string;
  name: string;
}

interface ExtendedWebSocket extends WebSocket {
  id: string;
  roomId: string;
}

export const taskPoker = async (
  user: UserInput,
  room: RoomInput,
  ws: WebSocket,
  wss: ExtendedWSS
): Promise<
  | { user: UserInput; room: Room & { tasks: Task[]; users: User[] } }
  | { error: string }
> => {
  try {
    // 1. Sprawdź pokój i użytkowników
    const fRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: { users: true }
    });

    if (!fRoom) {
      return { error: "Room not found" };
    }

    const userIds = fRoom.users.map((u) => u.id);

    // 2. Usuń stare taski i dodaj nowe
    await prisma.task.deleteMany({ where: { roomId: room.id } });

    await prisma.task.createMany({
      data: room.tasks.map((task) => ({
        name: task.name,
        status: task.status,
        link: task.link ?? null,
        points: task.points || '0',
        roomId: room.id
      }))
    });

    // 3. Pobierz zaktualizowany pokój z pełnym zakresem danych
    const updatedRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        users: true,
        tasks: true,
        votes: true,
        messages: true
      }
    });

    if (!updatedRoom) {
      return { error: "Updated room not found" };
    }

    // 4. Broadcast do użytkowników w pokoju
    for (const u of wss.users) {
      if (userIds.includes(u.id!)) {
        u.ws.send(`${user.name} has changed tasks.`);
        u.ws.send(
          JSON.stringify({
            type: messageTypes.UPDATE,
            room: {
              id: updatedRoom.id,
              name: updatedRoom.name,
              points: updatedRoom.points,
              revealed: updatedRoom.revealed,
              createdAt: updatedRoom.createdAt,
              users: updatedRoom.users,
              tasks: updatedRoom.tasks,
              votes: updatedRoom.votes,
              messages: updatedRoom.messages
            }
          })
        );
      }
    }

    return { user, room: updatedRoom };
  } catch (error) {
    console.error("[TASK_POKER] Error:", error);
    ws.send(
      JSON.stringify({
        type: messageTypes.ERROR,
        message: "Error updating tasks"
      })
    );
    return { error: "DB error" };
  }
};
