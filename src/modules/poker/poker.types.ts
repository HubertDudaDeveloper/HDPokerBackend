import { Server as WebSocketServer } from "ws";
import type WS from "ws";
import { Room } from "@prisma/client";

export interface ExtendedWebSocket extends WS {
  id?: string;
  roomId?: string;
  name?: string;
}

export interface ExtendedWSS extends WebSocketServer {
  users: {
    id: string;
    ws: ExtendedWebSocket;
    name: string;
    roomId: string;
  }[];
  rooms: Room[];
}

export const messageTypes = {
  INIT: "init", //stwórz pokój
  VOTE: "vote", //zagłosuj w pokoju
  RESET: "reset", //zresetuj głosy w pokoju
  JOIN: "join", //dołącz do pokoju
  LEAVE: "leave", //opuść pokój
  MESSAGE: "message", //wyslij wiadomość w pokoju
  TASK: "task", // ustaw/usuń/edytuj task w pokoju
  REVEAL: "reveal", // odkryj głosy w pokoju
  UPDATE: "update", // zaktualizuj pokój
  ERROR: "error", // błąd
};
