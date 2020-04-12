import SocketIO, { Socket } from "socket.io";
import { Commit, Module } from "vuex";

import { TestSchema } from "./schema";

export type CushaxSchema = Module<any, any>;

interface PageSyncEvent<TSchema = any> {
  enter?: {
    page: string;
    payload: Payload<TSchema>;
  };
  update?: {
    page: string;
    payload: Payload<TSchema>;
  };
  leave?: {
    page: string;
    payload: Payload<TSchema>;
  };
}

export default class Cushax<TSchema extends CushaxSchema> {
  private pageNameToOptionsMap = new Map<string, PageOptions<TSchema>>();
  private namespace: SocketIO.Namespace;

  constructor(public server: SocketIO.Server = SocketIO()) {
    this.namespace = this.server.of("/cushax");

    this.namespace.on("connection", (socket) => {
      socket.on("page:sync", (event) => this.onPageSync(socket, event));
    });
  }

  page(options: PageOptions<TSchema>): void {
    this.pageNameToOptionsMap.set(options.name as string, options);
  }

  commit: Commit = (...args: any[]) => {
    this.namespace.clients((_: any, [id]: string[]) => {
      this.namespace.to(id).emit("commit", ...args);
    });
  };

  private onPageSync = (socket: Socket, event: PageSyncEvent) => {
    try {
      let { enter, leave, update } = event;

      let map = this.pageNameToOptionsMap;

      if (enter) {
        map
          .get(enter.page)
          ?.enter?.(enter.payload, this.getPage(socket, enter.page));
      }

      if (leave) {
        let options = map.get(leave.page);

        if (options) {
          options.leave?.(leave.payload, this.getPage(socket, leave.page));

          if (!options.keep) {
            this.resetPage(socket, options.name as string);
          }
        }
      }

      if (update) {
        map
          .get(update.page)
          ?.update?.(update.payload, this.getPage(socket, update.page));
      }
    } catch (error) {
      console.log(error);

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
    console.log("RESET");
  }

  private getPage(socket: Socket, page: string): any {
    return {
      commit: (name: string, payload: any) =>
        this.onPageCommit.apply(undefined, [socket, page, name, payload]),
    } as Page<any>;
  }
}

const io = SocketIO();

io.listen(80);

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

type Page<
  TSchema extends CushaxSchema,
  TPair = ObjectPropertyToPair<TSchema, "mutations", keyof TSchema["mutations"]>
> = UnionToIntersection<
  TPair extends [infer TName, infer TFunction]
    ? TFunction extends (state: any, payload: infer TPayload) => any
      ? { commit: (name: TName, payload: TPayload) => void }
      : never
    : never
>;

type Payload<
  TSchema extends CushaxSchema,
  TD = Pick<TSchema["state"], "$params" | "$query">
> = UnionToIntersection<TD> extends { $params: infer P; $query: infer Q }
  ? { params: P; query: Q }
  : never;

export type PageOptions<
  TSchema extends CushaxSchema,
  TSchemaPair = ObjectPropertyToPair<
    TSchema,
    "modules",
    keyof TSchema["modules"]
  >
> = TSchemaPair extends [infer TName, infer TModule]
  ? {
      // from route name or  route meta: { cushax: "hello-world" }
      name: TName;
      enter(payload: Payload<TModule>, page: Page<TModule>): void;
      leave(payload: Payload<TModule>, page: Page<TModule>): void;
      update(payload: Payload<TModule>, page: Page<TModule>): void;
      keep?: boolean;
    }
  : never;

let cushax = new Cushax<TestSchema>(io);

cushax.page({
  name: "foo",
  enter({ params }, page) {
    console.log("foo enter");

    page.commit("changeAge", 18);
    page.commit("setName", "boen");
  },
  leave() {
    console.log("foo leave");
  },
  update() {},
});

cushax.page({
  name: "bar",
  enter({ params }, page) {
    console.log("bar enter");

    page.commit("changeLength", 666);
  },
  leave() {
    console.log("bar leave");
  },
  update() {},
});
