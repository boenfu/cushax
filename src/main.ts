import SocketIO, { Socket } from "socket.io";
import { Module } from "vuex";

export type CushaxSchema = Module<any, any>;

export type SocketIdentity = Socket | Socket["id"];

declare module "socket.io" {
  interface Socket {
    $cushax_verified: boolean;
  }
}

export default class Cushax<TSchema extends CushaxSchema> {
  private pageNameToOptionsMap = new Map<string, PageOptions<TSchema>>();
  private authFns: AuthFunction<TSchema>[] = [];

  private namespace: SocketIO.Namespace;

  get commit(): Page<TSchema, SocketIdentity> extends { commit: infer TCommit }
    ? TCommit
    : never {
    return this._commit as any;
  }

  constructor(public server: SocketIO.Server = SocketIO()) {
    this.namespace = this.server.of("/cushax");

    this.namespace.on("connection", (socket) => {
      socket.on("auth", (event) => this.onAuth(socket, event));
      socket.on(
        "page:sync",
        (event) => this._checkAuth(socket) && this.onPageSync(socket, event)
      );
      socket.on(
        "page:event",
        (event) => this._checkAuth(socket) && this.onPageEvent(socket, event)
      );
    });
  }

  auth(fn: AuthFunction<TSchema>): void {
    this.authFns.push(fn);
  }

  page(options: PageOptions<TSchema>): void {
    this.pageNameToOptionsMap.set(options.name as string, options);
  }

  private _checkAuth(socket: Socket): boolean {
    return !this.authFns.length || socket.$cushax_verified;
  }

  private _commit(
    name: string,
    payload: any,
    socket?: Socket | Socket["id"]
  ): void {
    if (socket) {
      let id = typeof socket === "string" ? socket : socket.id;
      this.namespace.to(id).emit("commit", name, payload);
    } else {
      this.namespace.emit("commit", name, payload);
    }
  }

  private onAuth = async (socket: Socket, event: any) => {
    try {
      for (let fn of this.authFns) {
        let passed = await fn.call(undefined, event);

        if (!passed) {
          throw Error();
        }
      }

      socket.$cushax_verified = true;
      socket.emit("auth", true);
    } catch (error) {
      socket.$cushax_verified = false;
      socket.emit("auth", false);
    }
  };

  private onPageSync = (socket: Socket, event: PageSyncEvent) => {
    try {
      let { enter, leave, update } = event;

      let map = this.pageNameToOptionsMap;

      if (enter) {
        map.get(enter.page)?.enter?.({
          payload: enter.payload,
          page: this.getPage(socket, enter.page),
          socket,
        });
      }

      if (leave) {
        let options = map.get(leave.page);

        if (options) {
          options.leave?.({
            payload: leave.payload,
            page: this.getPage(socket, leave.page),
            socket,
          });

          if (!options.keep) {
            this.resetPage(socket, options.name as string);
          }
        }
      }

      if (update) {
        map.get(update.page)?.update?.({
          payload: update.payload,
          page: this.getPage(socket, update.page),
          socket,
        });
      }
    } catch (error) {
      this.resetPage(
        socket,
        ...Object.values(event)
          .map(({ page }) => page)
          .filter((page): page is string => !!page)
      );
    }
  };

  private onPageEvent = (socket: Socket, event: PageEventEvent) => {
    try {
      let {
        page: { page, payload },
        event: eventName,
        data,
      } = event;

      let map = this.pageNameToOptionsMap;

      (map.get(page) as any)?.[eventName]?.({
        data,
        payload,
        page: this.getPage(socket, page),
        socket,
      });
    } catch (error) {
      this.resetPage(
        socket,
        ...Object.values(event)
          .map(({ page }) => page)
          .filter((page): page is string => !!page)
      );
    }
  };

  private onPageCommit = (
    socket: Socket,
    page: string,
    name: string,
    payload: any
  ) => {
    socket.emit("page:sync", page, name, payload);
  };

  private resetPage(socket: Socket, ...pages: string[]) {
    socket.emit("*", pages);
  }

  private getPage(socket: Socket, page: string): any {
    return {
      commit: (name: string, payload: any) =>
        this.onPageCommit.apply(undefined, [socket, page, name, payload]),
    } as Page<any>;
  }
}

// utils

// https://stackoverflow.com/a/50375286/13030406
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

type ObjectPropertyToPair<
  TObject,
  TKey extends keyof TObject,
  TPKey
> = TPKey extends keyof TObject[TKey] ? [TPKey, TObject[TKey][TPKey]] : never;

// types

export type Page<
  TSchema extends CushaxSchema,
  TSocket = never,
  TPair = ObjectPropertyToPair<TSchema, "mutations", keyof TSchema["mutations"]>
> = UnionToIntersection<
  TPair extends [infer TName, infer TFunction]
    ? TFunction extends (state: any, payload: infer TPayload) => any
      ? { commit: (name: TName, payload: TPayload, socket?: TSocket) => void }
      : never
    : never
>;

export type Payload<
  TSchema extends CushaxSchema,
  TData = Pick<TSchema["state"], "$params" | "$query">
> = UnionToIntersection<TData> extends { $params: infer P; $query: infer Q }
  ? { params: P; query: Q }
  : never;

export type PageCustomEvent<
  TSchema extends CushaxSchema,
  TEvent = Pick<TSchema["state"], "$event">
> = UnionToIntersection<TEvent> extends { $event: infer E }
  ? {
      /**
       * custom events
       */
      [TKey in keyof E]: (event: {
        data: E[TKey];
        payload: Payload<TSchema>;
        page: Page<TSchema>;
        socket: Socket;
      }) => void;
    }
  : never;

export type AuthFunction<TSchema extends CushaxSchema> = (
  data: TSchema["state"]["$auth"]
) => boolean;

export type PageOptions<
  TSchema extends CushaxSchema,
  TSchemaPair = ObjectPropertyToPair<
    TSchema,
    "modules",
    keyof TSchema["modules"]
  >
> = TSchemaPair extends [infer TName, infer TModule]
  ? {
      /**
       * From route name or  route meta: { cushax: "hello-world" }
       */
      name: TName;
      enter?(event: {
        payload: Payload<TModule>;
        page: Page<TModule>;
        socket: Socket;
      }): void;
      leave?(event: {
        payload: Payload<TModule>;
        page: Page<TModule>;
        socket: Socket;
      }): void;
      update?(event: {
        payload: Payload<TModule>;
        page: Page<TModule>;
        socket: Socket;
      }): void;
      /**
       * `true` will keep state after router leave
       */
      keep?: boolean;
    } & PageCustomEvent<TModule>
  : never;

// internal use

interface PageInfo {
  page: string;
  payload: Payload<any>;
}

interface PageSyncEvent {
  enter?: PageInfo;
  update?: PageInfo;
  leave?: PageInfo;
}

interface PageEventEvent {
  event: string;
  page: PageInfo;
  data: any;
}
