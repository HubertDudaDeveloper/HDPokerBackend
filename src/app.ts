import express, { Request, Response } from "express";
import { messageTypes } from "./modules/poker/poker.types";
import { PrismaClient } from "@prisma/client";
import cors from 'cors';

const prisma = new PrismaClient();

const app = express();
app.use(express.json());
app.use(cors());

// Healthcheck
app.get("/health", (_, res) => {
  res.status(200).send("OK");
});

app.post("/room-info", async (req: Request, res: Response) => {
  const roomName = req.body.room.name;
  const password = req.body.room.password;
  const type = req.body.type;

  try {
    const roomInfo = await prisma.room.findUnique({
      where: { name: roomName },
    });

    let message;

    if (roomInfo) {
      message =
        type === messageTypes.JOIN
          ? {
              type: messageTypes.JOIN,
              response: roomInfo.password === password,
              message:
                roomInfo.password === password
                  ? "Room joined"
                  : "Wrong password",
            }
          : {
              type: messageTypes.INIT,
              response: false,
              message: "Room already exists",
            };
    } else {
      message =
        type === messageTypes.JOIN
          ? {
              type: messageTypes.JOIN,
              response: false,
              message: "Room does not exist",
            }
          : {
              type: messageTypes.INIT,
              response: true,
              message: "Room created",
            };
    }

    res.send(JSON.stringify(message));
  } catch (error) {
    console.error("Error checking room:", error);
    res
      .status(500)
      .json({ type: messageTypes.ERROR, message: "Internal server error" });
  }
});

export default app;
