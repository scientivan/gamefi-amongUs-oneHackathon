export enum RoomType {
  ENGINE_ROOM = "Engine Room",
  WEAPONS_TOP = "Weapons (Top)",
  WEAPONS_BOTTOM = "Weapons (Bottom)",
  MEDBAY = "MedBay",
  CAFETERIA = "Cafeteria",
  STORAGE = "Storage",
  ADMIN = "Admin",
  NAVIGATION = "Navigation",
  BRIDGE = "Bridge",
  SHIELDS = "Shields",
  HALLWAY = "Hallway",
}

export type Player = {
  id: string;
  name: string;
  address?: string;
  role: "Crewmate" | "Impostor";
  alive: boolean;
  avatar?: string;
  owner?: string; // X handle
  ownerAvatar?: string;
  ownerFollowers?: number;
  karma?: number;
  posts?: string[];
  x?: number;
  y?: number;
  room?: RoomType;
};

export type GameState = {
  id: string;
  players: Record<string, Player>;
  phase: string;
  messages: { sender: string; content: string }[];
};
