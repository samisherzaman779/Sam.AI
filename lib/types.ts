export type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number; error?: string; streaming?: boolean };
export type Conv = { id: string; title: string; messages: Msg[]; updated: number };
