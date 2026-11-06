import { useEffect, useRef } from 'react';
import type { System, DebtCustomer, BuffetItem, CardReader, RatesTable } from '../types';
import { getSessionMetrics } from '../utils';

type Method = 'cash' | 'card' | 'debt';
type Items = { id: string; quantity: number }[];

export type RemoteCommand = { id: string; device: string } & (
  | { type: 'start'; systemId: string; customerName: string; playersCount: 1 | 2 | 3 | 4 }
  | { type: 'pause' | 'resume'; systemId: string }
  | { type: 'ledger'; debtorId: string; kind: 'debt_added' | 'payment_made'; amount: number; description: string }
  | { type: 'players'; systemId: string; playersCount: 1 | 2 | 3 | 4 }
  | { type: 'adjustTime'; systemId: string; minutes: number }
  | { type: 'transfer'; sourceId: string; targetId: string }
  | { type: 'addBuffet'; systemId: string; items: Items }
  | { type: 'settle'; systemId: string; method: Method; cardReaderId?: string; debtorId?: string; round?: boolean }
  | { type: 'directSale'; items: Items; customerName: string; method: Method; cardReaderId?: string; debtorId?: string }
);

// null = موفق، string = متن خطا، {message} = موفق همراه پیام برای گوشی
export type RemoteResult = string | null | { message: string };

export interface RemoteActions {
  start: (systemId: string, customerName: string, playersCount: 1 | 2 | 3 | 4, device: string) => RemoteResult;
  pause: (systemId: string, device: string) => RemoteResult;
  resume: (systemId: string, device: string) => RemoteResult;
  ledger: (debtorId: string, kind: 'debt_added' | 'payment_made', amount: number, description: string, device: string) => RemoteResult;
  players: (systemId: string, playersCount: 1 | 2 | 3 | 4, device: string) => RemoteResult;
  adjustTime: (systemId: string, minutes: number, device: string) => RemoteResult;
  transfer: (sourceId: string, targetId: string, device: string) => RemoteResult;
  addBuffet: (systemId: string, items: Items, device: string) => RemoteResult;
  settle: (systemId: string, opts: { method: Method; cardReaderId?: string; debtorId?: string; round?: boolean }, device: string) => RemoteResult;
  directSale: (items: Items, customerName: string, opts: { method: Method; cardReaderId?: string; debtorId?: string }, device: string) => RemoteResult;
}

export interface RemoteData {
  systems: System[];
  debtors: DebtCustomer[];
  buffetItems: BuffetItem[];
  cardReaders: CardReader[];
  rates: RatesTable;
}

declare global {
  interface Window {
    remoteBridge?: {
      pushState: (s: unknown) => void;
      reply: (r: { id: string; ok: boolean; error: string | null; message?: string }) => void;
      onCommand: (cb: (c: RemoteCommand) => void) => () => void;
      getInfo: () => Promise<{ port: number; addresses: string[] }>;
      newPairCode: () => Promise<{ code: string; expiresAt: number }>;
      listDevices: () => Promise<{ id: string; name: string; createdAt: string; lastSeen: string | null }[]>;
      revokeDevice: (id: string) => Promise<boolean>;
    };
  }
}

function buildSnapshot(d: RemoteData) {
  return {
    systems: d.systems.map((s) => {
      const a = s.activeSession;
      const r = d.rates[s.type];
      let metrics: Record<string, number> | null = null;
      if (a && r) {
        const m = getSessionMetrics(a, r);
        metrics = {
          gamePlayCost: m.gamePlayCost,
          buffetCost: m.buffetCost,
          extraServicesCost: m.extraServicesCost,
          totalCost: m.totalCost,
          durationMinutes: m.durationMinutes,
          partialPaid: (a.partialPayments || []).reduce((acc, p) => acc + p.amount, 0),
        };
      }
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        session: a
          ? {
              customerName: a.customerName,
              startTime: a.startTime,
              pausedTime: a.pausedTime ?? null,
              totalPausedMs: a.totalPausedMs,
              playersCount: a.playersCount,
              buffetItems: (a.buffetItems || []).map((b) => ({ id: b.id, name: b.name, price: b.price, quantity: b.quantity })),
              metrics,
            }
          : null,
      };
    }),
    debtors: d.debtors.map((x) => ({ id: x.id, name: x.name, phone: x.phone, balance: x.balance })),
    buffet: d.buffetItems.map((b) => ({ id: b.id, name: b.name, price: b.price, stock: b.stock ?? null, category: b.category ?? null })),
    cardReaders: d.cardReaders.map((c) => ({ id: c.id, name: c.name })),
  };
}

export function useRemoteBridge(data: RemoteData, actions: RemoteActions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const dataRef = useRef(data);
  dataRef.current = data;

  const push = () => window.remoteBridge?.pushState(buildSnapshot(dataRef.current));

  // هر تغییر state + هر ۳ ثانیه (برای به‌روز ماندن مبلغ‌های لحظه‌ای)
  useEffect(() => {
    push();
  }, [data.systems, data.debtors, data.buffetItems, data.cardReaders, data.rates]);

  useEffect(() => {
    if (!window.remoteBridge) return;
    const t = setInterval(push, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const bridge = window.remoteBridge;
    if (!bridge) return;
    return bridge.onCommand((cmd) => {
      let res: RemoteResult;
      try {
        const a = actionsRef.current;
        switch (cmd.type) {
          case 'start': res = a.start(cmd.systemId, cmd.customerName, cmd.playersCount, cmd.device); break;
          case 'pause': res = a.pause(cmd.systemId, cmd.device); break;
          case 'resume': res = a.resume(cmd.systemId, cmd.device); break;
          case 'ledger': res = a.ledger(cmd.debtorId, cmd.kind, cmd.amount, cmd.description, cmd.device); break;
          case 'players': res = a.players(cmd.systemId, cmd.playersCount, cmd.device); break;
          case 'adjustTime': res = a.adjustTime(cmd.systemId, cmd.minutes, cmd.device); break;
          case 'transfer': res = a.transfer(cmd.sourceId, cmd.targetId, cmd.device); break;
          case 'addBuffet': res = a.addBuffet(cmd.systemId, cmd.items, cmd.device); break;
          case 'settle': res = a.settle(cmd.systemId, { method: cmd.method, cardReaderId: cmd.cardReaderId, debtorId: cmd.debtorId, round: cmd.round }, cmd.device); break;
          case 'directSale': res = a.directSale(cmd.items, cmd.customerName, { method: cmd.method, cardReaderId: cmd.cardReaderId, debtorId: cmd.debtorId }, cmd.device); break;
          default: res = 'دستور ناشناخته';
        }
      } catch (e: any) {
        res = String(e?.message || e);
      }
      const error = typeof res === 'string' ? res : null;
      const message = res && typeof res === 'object' ? res.message : undefined;
      bridge.reply({ id: cmd.id, ok: !error, error, message });
      // بعد از اجرای دستور، یک snapshot تازه بفرست
      setTimeout(push, 300);
    });
  }, []);
}
