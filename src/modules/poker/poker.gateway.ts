import { WebSocketServer, WebSocket } from "ws";
import { initPoker } from "./handlers/init";
import { joinPoker } from "./handlers/join";
import { votePoker } from "./handlers/vote";
import { resetPoker } from "./handlers/reset";
import { revealPoker } from "./handlers/reveal";
import { taskPoker } from "./handlers/task";
import { ExtendedWSS, messageTypes } from "./poker.types";
import { leavePoker } from "./handlers/leave";

type PokerMessage = {
  type: string;
  user: any;
  room: any;
};

export const setupPokerWebSocket = (wss: ExtendedWSS) => {
  wss.users = wss.users || [];

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] Nowe połączenie");

    ws.on("message", async (msg) => {
      const str = msg.toString();

      if (str === "ping") {
        ws.send("pong");
        return;
      }

      if (str === "pong") {
        return;
      }

      try {
        const data = JSON.parse(msg.toString()) as PokerMessage;

        console.log(data)
        const { user, room } = data;

        switch (data.type) {
          case messageTypes.INIT:
            await initPoker(user, room, ws, wss);
            break;
          case messageTypes.JOIN:
            await joinPoker(user, room, ws, wss);
            break;
          case messageTypes.VOTE:
            await votePoker(user, room, ws, wss);
            break;
          case messageTypes.RESET:
            await resetPoker(user, room, ws, wss);
            break;
          case messageTypes.REVEAL:
            await revealPoker(user, room, ws, wss);
            break;
          case messageTypes.TASK:
            await taskPoker(user, room, ws, wss);
            break;
          case messageTypes.LEAVE:
            await leavePoker(user, room, ws, wss);
            break;
          default:
            ws.send(
              JSON.stringify({ type: "ERROR", message: "Unknown message type" })
            );
        }
      } catch (err) {
        console.error("[WS] Błąd parsowania wiadomości:", err);
        ws.send(
          JSON.stringify({ type: "ERROR", message: "Invalid message format" })
        );
      }
    });

    ws.on("close", async () => {
      console.log("[WS] Połączenie zamknięte");

      // Znajdź użytkownika po websocket
      const userLeaving = wss.users.find((u) => u.ws === ws);

      if (!userLeaving || !userLeaving.id || !userLeaving.roomId) {
        console.warn("[WS] Nie znaleziono użytkownika lub brak roomId");
        return;
      }

      try {
        // Spróbuj wywołać leavePoker dla danego użytkownika
        await leavePoker(
          { id: userLeaving.id, name: userLeaving.name },
          { id: userLeaving.roomId },
          ws,
          wss
        );
      } catch (error) {
        console.error("[WS] Błąd podczas automatycznego leavePoker:", error);
      }
    });
  });
};
