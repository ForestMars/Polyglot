// src/services/indexedDbStorage.ts
// Pure storage layer. No fetch calls, no Lamport clock, no sync logic.
// All server communication goes through backgroundSync.ts.

import Dexie, { Table } from "dexie";

export interface Chat {
  id?: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  lastModified: Date;
  model?: string;
  provider?: string;
  currentModel?: string;
  isArchived?: boolean;
  updatedAtLamport?: [number, string];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isPrivate?: boolean;
}

export interface AppMeta {
  id: string;
  lastSync?: Date;
  version?: string;
  [key: string]: any;
}

export class PolyglotDatabase extends Dexie {
  chats!: Table<Chat, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super("PolyglotDB");
    this.version(1).stores({
      chats: "++id, title, createdAt, updatedAt, lastModified, model, provider, currentModel, isArchived",
      meta: "id, lastSync, version",
    });
    this.version(1).upgrade(async (trans) => {
      await trans.table("meta").put({ id: "app", version: "1.0.0", lastSync: null });
    });
  }
}

export const db = new PolyglotDatabase();

export class IndexedDbStorage {
  private db: PolyglotDatabase;

  constructor(database: PolyglotDatabase) {
    this.db = database;
  }

  private convertDatesToObjects(chat: any): Chat {
    return {
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
      lastModified: new Date(chat.lastModified || chat.updatedAt || Date.now()),
      isArchived: chat.isArchived || false,
      currentModel: chat.currentModel || chat.model,
      messages: (chat.messages || []).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    };
  }

  private prepareChatForStorage(chat: Chat): Chat {
    const now = new Date();
    const filteredMessages = (chat.messages || []).filter((msg) => !msg.isPrivate);
    return {
      ...chat,
      id: chat.id || crypto.randomUUID(),
      createdAt: chat.createdAt || now,
      updatedAt: now,
      lastModified: now,
      isArchived: chat.isArchived || false,
      currentModel: chat.currentModel || chat.model || "unknown",
      messages: filteredMessages.map((msg) => ({
        ...msg,
        id: msg.id || crypto.randomUUID(),
        timestamp: msg.timestamp || now,
      })),
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.db.open();
      const tableNames = this.db.tables.map((t) => t.name);
      for (const expected of ["chats", "meta"]) {
        if (!tableNames.includes(expected)) throw new Error(`Missing table: ${expected}`);
      }
      console.log("Database initialized:", tableNames);
    } catch (error) {
      if (error.name === "VersionError" || error.name === "NotFoundError") {
        await this.db.delete();
        this.db = new PolyglotDatabase();
        await this.db.open();
      } else {
        throw error;
      }
    }
  }

  async getMeta(id: string = "app"): Promise<AppMeta | null> {
    try {
      const meta = await this.db.meta.get(id);
      if (meta?.lastSync) meta.lastSync = new Date(meta.lastSync);
      return meta || null;
    } catch {
      return null;
    }
  }

  async setMeta(meta: AppMeta): Promise<void> {
    if (!meta.id) throw new Error("Meta must have an id");
    try {
      await this.db.meta.put(meta);
    } catch (error) {
      if (error.name === "NotFoundError") {
        await this.initialize();
        await this.db.meta.put(meta);
      } else {
        throw error;
      }
    }
  }

  async getChats(): Promise<Chat[]> {
    try {
      const chats = await this.db.chats.orderBy("lastModified").reverse().toArray();
      return chats.map((c) => this.convertDatesToObjects(c));
    } catch {
      return [];
    }
  }

  async getChat(id: string): Promise<Chat | null> {
    try {
      const chat = await this.db.chats.get(id);
      return chat ? this.convertDatesToObjects(chat) : null;
    } catch {
      return null;
    }
  }

  async saveChat(chat: Chat): Promise<string> {
    const prepared = this.prepareChatForStorage(chat);
    const id = await this.db.chats.put(prepared);
    return typeof id === "string" ? id : String(id);
  }

  async deleteChat(id: string): Promise<void> {
    await this.db.chats.delete(id);
  }

  async listConversations(showArchived = false): Promise<Chat[]> {
    try {
      const chats = await this.db.chats.orderBy("lastModified").reverse().toArray();
      const converted = chats.map((c) => this.convertDatesToObjects(c));
      return showArchived ? converted : converted.filter((c) => !c.isArchived);
    } catch {
      return [];
    }
  }

  async loadConversation(id: string): Promise<Chat> {
    const chat = await this.db.chats.get(id);
    if (!chat) throw new Error(`Conversation not found: ${id}`);
    return this.convertDatesToObjects(chat);
  }

  // saveConversation and deleteConversation are intentionally removed.
  // All callers must go through conversationSync.ts which handles
  // Lamport stamping and server propagation.

  async migrateFromLocalStorage(): Promise<void> {
    try {
      const localData = localStorage.getItem("polyglot-chats");
      if (!localData) return;
      const chats: Chat[] = JSON.parse(localData);
      for (const chat of chats) await this.saveChat(chat);
      localStorage.removeItem("polyglot-chats");
      console.log("[migration] Migrated from localStorage");
    } catch (error) {
      console.error("[migration] Failed:", error);
    }
  }

  async isReady(): Promise<boolean> {
    try {
      await this.db.open();
      return true;
    } catch {
      return false;
    }
  }
}

export const indexedDbStorage = new IndexedDbStorage(db);
export const ready = indexedDbStorage.initialize();
export const storage = indexedDbStorage;
ready.catch(console.error);