import { io, Socket } from "socket.io-client";

// Establishes connection to the same origin serving the frontend SPA
export const socket: Socket = io();
