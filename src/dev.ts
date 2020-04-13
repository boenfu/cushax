import SocketIO from "socket.io";
import { Module } from "vuex";

import Cushax from "./main";

export function Schema<S extends Module<any, any>>(s: S): S {
  return s;
}

const io = SocketIO();

io.listen(80);

let cushax = new Cushax<DevSchema>(io);

cushax.page({
  name: "foo",
  // before router enter
  async enter() {
    // root commit
    cushax.commit("changeUser", "boen" + Math.round(Math.random() * 530));

    await new Promise((r) => setTimeout(r, 1000));
  },
  // emit with $page.update()
  update({ params: { age } }, page) {
    page.commit("changeAge", age);
  },
  leave() {
    console.log("foo leave");
  },
  // custom event
  save({ name }) {
    cushax.commit("changeUser", name);
  },
});

// schema

export let schema = Schema({
  state: {
    user: "boen",
  },
  mutations: {
    changeUser(state: any, user: string) {
      state.user = user;
    },
  },
  modules: {
    foo: {
      state: {
        $params: {
          // router params & custom params from $page.update(params)
          id: "",
          age: 0,
        },
        $query: {
          // router query
        },
        $event: {
          // custom event, use $page.emit("save", {name: "boen"})
          save: { name: "" },
        },
        // page data
        age: 18,
      },
      mutations: {
        changeAge(state: any, age: number) {
          state.age = age;
        },
      },
    },
  },
});

export type DevSchema = typeof schema;
