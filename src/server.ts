import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import app from "./app";
import { setupPokerWebSocket } from "./modules/poker/poker.gateway";
import prisma from "./config/prisma";
import { ExtendedWSS } from "./modules/poker/poker.types";

// Załaduj zmienne środowiskowe
dotenv.config();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server }) as ExtendedWSS;
setupPokerWebSocket(wss); // tu podłącz logikę WebSocketa
wss.users = [];
wss.rooms = [];

// Start serwera HTTP i WebSocket
server.listen(PORT, () => {
  console.log(`Poker mikroserwis działa na porcie ${PORT}`);
});

// Bezpieczne zamknięcie Prisma przy zakończeniu
process.on("SIGINT", async () => {
  console.log("\nZamykam połączenie z bazą...");
  await prisma.$disconnect();
  process.exit(0);
});
